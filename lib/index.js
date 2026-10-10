/**
 * dsh-ui-llm-memories host entry.
 *
 * Owns the durable global memory store, an authenticated JSON-RPC channel for
 * the browser Memories view, a system-prompt section that injects important
 * entries into every model request, and five memory_* tools the model can use
 * to consult and maintain the store.
 */
import { readFileSync, renameSync } from "node:fs";
import { mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";
import { defineTool } from "@deepseek-ai/dsh-tools";

/** Cordis plugin identity. */
export const name = "llm-memories";
/**
 * Services are consumed through `ctx.inject(...)` child fibers, the pattern
 * every service consumer in this ecosystem uses; no static inject list.
 */

//#region limits and validation
/** Field limits applied to every write path (browser RPC and model tools). */
const LIMITS = {
	titleMax: 200,
	contentMax: 100000,
	tagCountMax: 12,
	tagLengthMax: 40,
	listCap: 50,
	searchCap: 50,
	injectedCountMax: 40,
	injectedCharsMax: 6000,
	injectedEntryCharsMax: 400,
	toolPreviewChars: 240,
};

/** UI color palette; null means "no category color". */
const COLORS = ["blue", "green", "amber", "red", "violet"];

/** Whether a value is a nonempty bounded string. */
function nonEmpty(value, max) {
	return typeof value === "string" && value.trim() !== "" && value.length <= max;
}

/** Normalize a tags input (array or comma/space separated string) to clean tags. */
function normalizeTags(input) {
	const raw = Array.isArray(input)
		? input
		: typeof input === "string"
			? input.split(/[,，]/u)
			: [];
	const tags = [];
	for (const entry of raw) {
		if (typeof entry !== "string") continue;
		const tag = entry.trim().replace(/^#/, "").slice(0, LIMITS.tagLengthMax);
		if (tag === "" || tags.includes(tag)) continue;
		tags.push(tag);
		if (tags.length >= LIMITS.tagCountMax) break;
	}
	return tags;
}

/** Clamp a declared importance onto 1..3. */
function clampImportance(value) {
	if (value === undefined || value === null) return 1;
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return 1;
	return Math.min(3, Math.max(1, Math.round(numeric)));
}

/** Validate one color name. */
function normalizeColor(value) {
	return typeof value === "string" && COLORS.includes(value) ? value : null;
}

/**
 * Validate and normalize a full or partial item payload.
 * @param input - raw payload fields.
 * @param partial - allow omitted title/content (update patches).
 * @returns normalized fields, or an error message.
 */
function sanitizeItem(input, partial) {
	if (input === null || typeof input !== "object") return { error: "payload must be an object" };
	const fields = {};
	if (input.title !== undefined || !partial) {
		if (!nonEmpty(input.title, LIMITS.titleMax)) return { error: `title must be a nonempty string of at most ${String(LIMITS.titleMax)} characters` };
		fields.title = input.title.trim().slice(0, LIMITS.titleMax);
	}
	if (input.content !== undefined || !partial) {
		if (input.content === undefined || input.content === null) fields.content = "";
		else if (typeof input.content !== "string" || input.content.length > LIMITS.contentMax) return { error: `content must be a string of at most ${String(LIMITS.contentMax)} characters` };
		else fields.content = input.content;
	}
	if (input.tags !== undefined) fields.tags = normalizeTags(input.tags);
	if (input.pinned !== undefined) fields.pinned = input.pinned === true;
	if (input.importance !== undefined) fields.importance = clampImportance(input.importance);
	if (input.color !== undefined) fields.color = normalizeColor(input.color);
	return { fields };
}
//#endregion

//#region store
/** Durable global memory store backed by one JSON file with atomic writes. */
class MemoryStore {
	/** Absolute store path. */
	constructor(path) {
		this.path = path;
		this.items = [];
		this.rev = 0;
	}

	/** Load synchronously at plugin start; a corrupt file is quarantined, not lost. */
	load() {
		let raw;
		try {
			raw = readFileSync(this.path, "utf8");
		} catch {
			return;
		}
		let parsed;
		try {
			parsed = JSON.parse(raw);
		} catch {
			try {
				renameSync(this.path, `${this.path}.corrupt-${Date.now()}`);
			} catch {}
			return;
		}
		const items = Array.isArray(parsed?.items) ? parsed.items.filter((item) => typeof item?.id === "string" && typeof item?.title === "string") : [];
		this.items = items.map((item) => ({
			id: item.id,
			title: item.title,
			content: typeof item.content === "string" ? item.content : "",
			tags: Array.isArray(item.tags) ? item.tags.filter((tag) => typeof tag === "string") : [],
			pinned: item.pinned === true,
			importance: clampImportance(item.importance),
			color: normalizeColor(item.color),
			createdAt: Number.isFinite(item.createdAt) ? item.createdAt : Date.now(),
			updatedAt: Number.isFinite(item.updatedAt) ? item.updatedAt : Date.now(),
		}));
	}

	/** Persist atomically (tmp file + rename). */
	async persist() {
		const body = JSON.stringify({ version: 1, items: this.items }, null, "\t") + "\n";
		const temp = `${this.path}.tmp-${randomBytes(4).toString("hex")}`;
		await mkdir(dirname(this.path), { recursive: true });
		await writeFile(temp, body, "utf8");
		await rename(temp, this.path);
		this.rev += 1;
	}

	/** Working list order: pinned, then importance, then recency. */
	static compare(left, right) {
		if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
		if (left.importance !== right.importance) return right.importance - left.importance;
		return right.updatedAt - left.updatedAt;
	}

	/** Full listing for the browser view. */
	list() {
		return [...this.items].sort(MemoryStore.compare);
	}

	/** Create one entry; resolves with the stored item. */
	async create(input) {
		const { fields, error } = sanitizeItem(input, false);
		if (error !== undefined) throw new MemoryError("memories/invalid", error);
		const now = Date.now();
		const item = {
			id: `m_${now.toString(36)}_${randomBytes(4).toString("hex")}`,
			title: fields.title,
			content: fields.content ?? "",
			tags: fields.tags ?? [],
			pinned: fields.pinned ?? false,
			importance: fields.importance ?? 1,
			color: fields.color ?? null,
			createdAt: now,
			updatedAt: now,
		};
		this.items.push(item);
		await this.persist();
		return item;
	}

	/** Patch one entry by id; unknown ids reject. */
	async update(id, patch) {
		if (typeof id !== "string" || id === "") throw new MemoryError("memories/invalid", "id must be a nonempty string");
		const item = this.items.find((entry) => entry.id === id);
		if (item === undefined) throw new MemoryError("memories/not-found", `no memory entry with id ${id}`);
		const { fields, error } = sanitizeItem(patch ?? {}, true);
		if (error !== undefined) throw new MemoryError("memories/invalid", error);
		Object.assign(item, fields, { updatedAt: Date.now() });
		await this.persist();
		return item;
	}

	/** Remove one entry by id. */
	async remove(id) {
		const index = typeof id === "string" ? this.items.findIndex((entry) => entry.id === id) : -1;
		if (index === -1) throw new MemoryError("memories/not-found", `no memory entry with id ${String(id)}`);
		this.items.splice(index, 1);
		await this.persist();
		return true;
	}

	/** Keyword search: every whitespace-separated term must match. */
	search(query) {
		const terms = typeof query === "string" ? query.trim().toLowerCase().split(/\s+/).filter((term) => term !== "") : [];
		if (terms.length === 0) return [];
		const matched = this.items.filter((item) => {
			const haystack = `${item.title}\n${item.content}\n${item.tags.join(" ")}`.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		});
		return matched.sort(MemoryStore.compare).slice(0, LIMITS.searchCap);
	}

	/** Entries injected into the system prompt: pinned or importance >= 2. */
	injected() {
		return this.items.filter((item) => item.pinned || item.importance >= 2).sort(MemoryStore.compare);
	}

	/** Render the system-prompt section; empty string contributes nothing. */
	renderSection() {
		const injected = this.injected();
		if (injected.length === 0) return "";
		const lines = [
			"## Long-term memory (persistent across sessions)",
			"",
			"Standing facts and preferences about this user, maintained in the Web client's Memories view. Honor them in every answer.",
			"The complete store — including entries not shown here — is available through the memory_list and memory_search tools; keep it current with memory_create / memory_update / memory_delete when the user corrects or adds facts.",
			"",
		];
		let chars = 0;
		let shown = 0;
		for (const item of injected) {
			if (shown >= LIMITS.injectedCountMax || chars >= LIMITS.injectedCharsMax) break;
			const content = item.content.length > LIMITS.injectedEntryCharsMax ? `${item.content.slice(0, LIMITS.injectedEntryCharsMax)}…` : item.content;
			const tags = item.tags.length > 0 ? ` (${item.tags.map((tag) => `#${tag}`).join(" ")})` : "";
			const line = `- [${item.id}] ${item.title}${content === "" ? "" : `: ${content}`}${tags}`;
			if (chars + line.length > LIMITS.injectedCharsMax && shown > 0) break;
			lines.push(line);
			chars += line.length;
			shown += 1;
		}
		const remaining = injected.length - shown;
		if (remaining > 0) lines.push("", `…and ${String(remaining)} more entr${remaining === 1 ? "y" : "ies"} (use memory_list).`);
		return lines.join("\n");
	}
}

/** Store-level user-visible failure with a stable code. */
class MemoryError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

//#endregion

//#region model tools
/** One memory entry as the model sees it (content preview). */
function toolPreview(item) {
	const truncated = item.content.length > LIMITS.toolPreviewChars;
	return {
		id: item.id,
		title: item.title,
		content: truncated ? `${item.content.slice(0, LIMITS.toolPreviewChars)}…` : item.content,
		truncated,
		tags: item.tags,
		pinned: item.pinned,
		importance: item.importance,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt,
	};
}

/** Render a tool result as compact text blocks. */
function renderText(_args, value) {
	return [{ type: "text", text: JSON.stringify(value, null, 2) }];
}

/** Build the five memory_* tool definitions over one store. */
function buildMemoryTools(store) {
	return [
		defineTool({
			name: "memory_list",
			description:
				"List every long-term memory entry for this user, in working order (pinned first, then importance, then recency). Each entry carries id, title, a content preview, tags, importance (1 normal, 2 important, 3 critical), pinned flag, and timestamps. Use memory_search for targeted lookup.",
			parameters: {},
			output: { schema: { type: "json" }, render: renderText },
			async execute() {
				return { count: store.items.length, items: store.list().slice(0, LIMITS.listCap).map(toolPreview) };
			},
		}),
		defineTool({
			name: "memory_search",
			description:
				"Search the user's long-term memory entries by keywords. Every whitespace-separated term must appear in the title, content, or tags (case-insensitive). Returns the full content of matching entries, best first.",
			parameters: {
				query: { type: "string", required: true, description: "Keywords; all must match, case-insensitive." },
			},
			output: { schema: { type: "json" }, render: renderText },
			async execute(args) {
				return { count: store.search(args.query).length, items: store.search(args.query) };
			},
		}),
		defineTool({
			name: "memory_create",
			description:
				"Create one long-term memory entry that persists across sessions. Use it when the user states a durable preference, convention, or fact worth remembering.",
			parameters: {
				title: { type: "string", required: true, description: "Short label, up to 200 characters." },
				content: { type: "string", required: true, description: "The fact or preference itself." },
				tags: { type: "array", items: { type: "string" }, description: "Optional tags for filtering." },
				importance: { type: "integer", description: "1 = normal, 2 = important (injected into context), 3 = critical (injected first). Defaults to 1." },
				pinned: { type: "boolean", description: "Pin to the top and inject into every request's context." },
			},
			output: { schema: { type: "json" }, render: renderText },
			async execute(args) {
				const item = await store.create(args);
				return { item: toolPreview(item) };
			},
		}),
		defineTool({
			name: "memory_update",
			description:
				"Update an existing long-term memory entry by id. Only the provided fields change; omitted fields keep their values. Use it when the user corrects a stored fact.",
			parameters: {
				id: { type: "string", required: true, description: "Entry id from memory_list or memory_search." },
				title: { type: "string", description: "New short label." },
				content: { type: "string", description: "New fact or preference text." },
				tags: { type: "array", items: { type: "string" }, description: "Replacement tag list." },
				importance: { type: "integer", description: "New importance 1..3." },
				pinned: { type: "boolean", description: "New pinned state." },
			},
			output: { schema: { type: "json" }, render: renderText },
			async execute(args) {
				const { id, ...patch } = args;
				const item = await store.update(id, patch);
				return { item: toolPreview(item) };
			},
		}),
		defineTool({
			name: "memory_delete",
			description:
				"Delete one long-term memory entry by id. Use it when the user says a stored memory is wrong or no longer wanted.",
			parameters: {
				id: { type: "string", required: true, description: "Entry id from memory_list or memory_search." },
			},
			output: { schema: { type: "json" }, render: renderText },
			async execute(args) {
				await store.remove(args.id);
				return { deleted: true, id: args.id };
			},
		}),
	];
}
//#endregion

//#region rpc bridge
/** Maximum accepted request body for one RPC call. */
const RPC_BODY_LIMIT = 5 * 1024 * 1024;

/** Read one buffered request body with a hard cap. */
function readBody(req) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let size = 0;
		req.on("data", (chunk) => {
			size += chunk.length;
			if (size > RPC_BODY_LIMIT) {
				reject(new Error("request body too large"));
				req.destroy();
				return;
			}
			chunks.push(chunk);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

/**
 * Bridge one admitted request to the memories RPC envelope, mirroring the
 * shared Connection channel semantics (envelope shape, method match, errors).
 * @param handle - endpoint dispatcher: (endpoint, payload) => result.
 */
function makeRpcRouteHandler(connectionCtx, handle) {
	return async (req, res) => {
		const write = (status, body) => {
			const payload = JSON.stringify(body);
			res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
			res.end(payload);
		};
		try {
			const admission = connectionCtx.connection.admit(req);
			if ("rejection" in admission) {
				res.writeHead(admission.rejection);
				res.end(admission.rejection === 401 ? "unauthorized" : "forbidden");
				return;
			}
			if (req.method !== "POST") {
				write(405, { error: "method not allowed" });
				return;
			}
			if ((req.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase() !== "application/json") {
				write(415, { error: "content type must be application/json" });
				return;
			}
			const raw = await readBody(req);
			let message;
			try {
				message = JSON.parse(raw);
			} catch {
				write(400, { error: "body is not JSON" });
				return;
			}
			if (
				message === null || typeof message !== "object" ||
				message.type !== "client-request" ||
				typeof message.rpcId !== "string" || message.rpcId === "" ||
				typeof message.method !== "string"
			) {
				write(400, { type: "server-response", rpcId: "invalid-request", result: { ok: false, error: { code: "gateway/bad-request", message: "invalid client-request message" } } });
				return;
			}
			const result = await handle(message.method, message.payload ?? {});
			write(200, { type: "server-response", rpcId: message.rpcId, result });
		} catch (error) {
			write(500, { error: `rpc failure: ${String(error instanceof Error ? error.message : error)}` });
		}
	};
}
//#endregion

//#region plugin body
/**
 * Install the memory store, the browser RPC channel, the prompt section, and
 * the model tools.
 * @param ctx - host Cordis context with webServer/connection/systemPrompt/tools.
 */
export function apply(ctx) {
	const home = process.env.DSH_HOME ?? join(homedir(), ".dsh");
	const store = new MemoryStore(join(home, "llm-memories.json"));
	store.load();


	const handleRpc = async (endpoint, payload) => {
		try {
			switch (endpoint) {
				case "list":
					return { ok: true, value: { items: store.list() } };
				case "create": {
					const item = await store.create(payload);
					return { ok: true, value: { item } };
				}
				case "update": {
					if (payload === null || typeof payload !== "object") throw new MemoryError("memories/invalid", "payload must be an object");
					const item = await store.update(payload.id, payload.patch ?? payload);
					return { ok: true, value: { item } };
				}
				case "delete": {
					if (payload === null || typeof payload !== "object") throw new MemoryError("memories/invalid", "payload must be an object");
					const removed = await store.remove(payload.id);
					return { ok: true, value: { removed } };
				}
				default:
					return { ok: false, error: { code: "memories/unknown-endpoint", message: `unknown endpoint ${String(endpoint)}` } };
			}
		} catch (error) {
			return {
				ok: false,
				error: {
					code: error instanceof MemoryError ? error.code : "memories/failed",
					message: error instanceof Error ? error.message : String(error),
				},
			};
		}
	};
	ctx.inject(["connection", "webServer"], (rpcCtx) => {
		rpcCtx.webServer.register({
			kind: "prefix",
			path: "/llm-memories",
			handler: makeRpcRouteHandler(rpcCtx, handleRpc),
		});
	});
	ctx.inject(["systemPrompt"], (promptCtx) => {
		promptCtx.systemPrompt.section({
			name: "llm-memories",
			order: 9500,
			text: () => store.renderSection(),
		});
	});
	ctx.inject(["tools"], (toolsCtx) => {
		for (const tool of buildMemoryTools(store)) toolsCtx.tools.register(tool);
	});

	ctx.logger?.info?.("llm-memories: store at %s (%d entries)", store.path, store.items.length);
}
//#endregion
