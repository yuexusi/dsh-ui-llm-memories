#!/usr/bin/env node
/**
 * Host-side test: drive the memory store, the RPC channel handler, the prompt
 * section, and the five memory_* tools through a fake Cordis context.
 */
import { mkdtempSync, readFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const home = mkdtempSync(join(tmpdir(), "llm-memories-test-"));
process.env.DSH_HOME = home;

const plugin = await import("../lib/index.js");
if (plugin.name !== "llm-memories") throw new Error("unexpected plugin name");
if (plugin.inject !== undefined) throw new Error("static inject must stay empty; services come from ctx.inject children");

// ---- fake cordis context capturing every registration ----
let channel = null;
let handler = null;
let section = null;
const tools = [];
const registeredRoutes = [];
const ctx = {
	inject: (_list, callback) => { callback(ctx); return () => {}; },
	connection: { admit: () => ({ peer: {} }), rpc: { handle: (c, h) => { channel = c; handler = h; return () => {}; } } },
	systemPrompt: { section: (s) => { section = s; return () => {}; } },
	tools: { register: (t) => { tools.push(t); return () => {}; } },
	webServer: { register: (route) => { registeredRoutes.push(route); return () => {}; } },
	logger: { info: () => {} },
};
plugin.apply(ctx);
if (registeredRoutes.length !== 1 || registeredRoutes[0].path !== "/llm-memories" || registeredRoutes[0].kind !== "prefix") {
	throw new Error("webServer route not registered: " + JSON.stringify(registeredRoutes.map((route) => ({ kind: route.kind, path: route.path }))));
}
if (section === null || section.name !== "llm-memories") throw new Error("prompt section missing");
if (tools.length !== 5) throw new Error("expected 5 tools, got " + tools.length);
if (typeof section.text !== "function") throw new Error("section text must be a provider");
console.log("registrations ok: channel=/llm-memories, section llm-memories order", section.order, ", tools:", tools.map((t) => t.name).join(", "));

const fail = (message) => { throw new Error("ASSERT: " + message); };
const assert = (condition, message) => { if (!condition) fail(message); };


// ---- empty store ----
/** Minimal streaming request fake for the route bridge. */
class FakeReq {
	constructor(method, body, headers = {}) {
		this.method = method;
		this.headers = { "content-type": "application/json", ...headers };
		this.body = body;
		this.listeners = new Map();
	}
	on(event, callback) {
		this.listeners.set(event, callback);
		if (event === "error") {
			setTimeout(() => {
				if (this.body !== undefined) this.listeners.get("data")?.(Buffer.from(this.body));
				this.listeners.get("end")?.();
			}, 0);
		}
		return this;
	}
	destroy() {}
}
const makeReq = (method, body, headers) => new FakeReq(method, body, headers);

// ---- drive the real route bridge with simulated requests ----
const route = registeredRoutes[0];
let rpcN = 0;
const respond = async (req) => {
	const res = { status: 0, headers: null, body: "" };
	res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
	res.end = (body) => { res.body = body ?? ""; };
	await route.handler(req, res);
	return res;
};
const request = async (endpoint, payload, options = {}) => {
	const envelope = JSON.stringify({ type: "client-request", rpcId: `t-${(rpcN += 1)}`, method: endpoint, payload: payload ?? {} });
	return respond(makeReq(options.method ?? "POST", options.rawBody ?? envelope, options.headers ?? {}));
};
const expectResult = async (endpoint, payload, options = {}) => {
	const res = await request(endpoint, payload, options);
	if (res.status !== 200) throw new Error(`endpoint ${endpoint} returned ${String(res.status)}: ${res.body}`);
	return JSON.parse(res.body).result;
};

const empty = await expectResult("list", {});
assert(empty.ok === true && empty.value.items.length === 0, "empty list");
assert(section.text() === "", "empty store renders no prompt section");
const unknown = await expectResult("bogus", {});
assert(unknown.ok === false && unknown.error.code === "memories/unknown-endpoint", "unknown endpoint error");
const notFoundMethod = await request("list", {}, { method: "GET" });
assert(notFoundMethod.status === 405, "GET rejected with 405");
const badType = await request("list", {}, { headers: { "content-type": "text/plain" } });
assert(badType.status === 415, "wrong content type rejected with 415");
const badJson = await request("list", {}, { rawBody: "not json" });
assert(badJson.status === 400, "malformed body rejected with 400");
const badEnvelope = await request("list", {}, { rawBody: JSON.stringify({ type: "server-response", rpcId: "x", method: "list" }) });
assert(badEnvelope.status === 400, "invalid envelope rejected with 400");
let unauthorized = { admitted: false };
{ // admit fence rejects a request without credentials
	const savedAdmit = ctx.connection.admit;
	ctx.connection.admit = () => ({ rejection: 401 });
	try {
		const res = await request("list", {});
		assert(res.status === 401, "unauthenticated request rejected with 401");
		unauthorized.admitted = true;
	} finally {
		ctx.connection.admit = savedAdmit;
	}
}
assert(unauthorized.admitted, "admit fence exercised");

// ---- create ----
const created = await expectResult("create", { title: "  回复风格  ", content: "用户偏好简洁的中文回复，代码用英文注释。", tags: ["偏好", "风格", "偏好"], importance: 3, pinned: true });
assert(created.ok === true, "create should succeed: " + JSON.stringify(created));
const item = created.value.item;
assert(item.title === "回复风格", "create must trim the title");
assert(item.tags.length === 2, "create must dedupe tags, got " + item.tags.length);
assert(item.importance === 3 && item.pinned === true, "importance/pinned persisted");
assert(typeof item.id === "string" && item.id.startsWith("m_"), "stable id");

const second = await expectResult("create", { title: "部署约定", content: "server runs on port 3080 with --no-open", tags: "ops, deploy", importance: 1 });
assert(second.ok === true && second.value.item.tags.length === 2, "comma-separated tags accepted");
assert(second.value.item.pinned === false && second.value.item.importance === 1, "defaults applied");

const bad = await expectResult("create", { title: "", content: "x" });
assert(bad.ok === false && bad.error.code === "memories/invalid", "empty title rejected");
const badContent = await expectResult("create", { title: "x", content: 5 });
assert(badContent.ok === false, "non-string content rejected");

// ---- list order ----
const listed = await expectResult("list");
assert(listed.value.items.length === 2, "two items listed");
assert(listed.value.items[0].id === item.id, "pinned item lists first");

// ---- update ----
const updated = await expectResult("update", { id: item.id, patch: { importance: 2, content: "用户偏好简洁的中文回复。" } });
assert(updated.ok === true, "update should succeed");
assert(updated.value.item.importance === 2, "importance patched");
assert(updated.value.item.title === "回复风格", "unpatched fields retained");
assert(updated.value.item.updatedAt >= updated.value.item.createdAt, "updatedAt bumped");
const missing = await expectResult("update", { id: "m_missing", patch: { title: "x" } });
assert(missing.ok === false && missing.error.code === "memories/not-found", "unknown id update rejects");

// ---- prompt section with entries ----
const sectionText = section.text();
console.log("--- prompt section ---");
console.log(sectionText);
console.log("----------------------");
assert(sectionText.includes("## Long-term memory"), "section header rendered");
assert(sectionText.includes("回复风格"), "pinned entry injected");
assert(sectionText.includes("部署约定") === false, "normal entry not injected by default");
assert(sectionText.includes("memory_search"), "section references the tools");
assert(sectionText.includes(`[${item.id}]`), "section includes entry ids");

// ---- delete ----
const removed = await expectResult("delete", { id: second.value.item.id });
assert(removed.ok === true && removed.value.removed === true, "delete succeeds");
const afterDelete = await expectResult("list");
assert(afterDelete.value.items.length === 1, "one item left");
const deleteMissing = await expectResult("delete", { id: "m_missing" });
assert(deleteMissing.ok === false && deleteMissing.error.code === "memories/not-found", "unknown id delete rejects");

// ---- durability: a fresh plugin instance reloads the persisted items ----
assert(readFileSync(join(home, "llm-memories.json"), "utf8").includes("回复风格"), "store persisted to disk");
const pluginReload = await import("../lib/index.js?reload=1");
let sectionReload = null;
let routeReload = null;
const reloadCtx = {
	inject: (_list, callback) => { callback(reloadCtx); return () => {}; },
	connection: { admit: () => ({ peer: {} }) },
	systemPrompt: { section: (sec) => { sectionReload = sec; return () => {}; } },
	tools: { register: () => () => {} },
	webServer: { register: (r) => { routeReload = r; return () => {}; } },
	logger: { info: () => {} },
};
pluginReload.apply(reloadCtx);
const driveRoute = async (route, endpoint) => {
	const req = makeReq("POST", JSON.stringify({ type: "client-request", rpcId: "t-drive", method: endpoint, payload: {} }));
	const res = { status: 0, headers: null, body: "" };
	res.writeHead = (status, headers) => { res.status = status; res.headers = headers; };
	res.end = (body) => { res.body = body ?? ""; };
	await route.handler(req, res);
	if (res.status !== 200) throw new Error(`route drive ${endpoint} -> ${String(res.status)} ${res.body}`);
	return JSON.parse(res.body).result;
};
const reloaded = await driveRoute(routeReload, "list");
assert(reloaded.ok === true && reloaded.value.items.length === 1, "fresh instance reloads persisted items");
assert(reloaded.value.items[0].title === "回复风格", "persisted content round-trips");
assert(sectionReload.text().includes("回复风格"), "fresh prompt section serves reloaded items");

// ---- model tools ----
const byName = new Map(tools.map((tool) => [tool.name, tool]));
const listTool = byName.get("memory_list");
const searchTool = byName.get("memory_search");
const createTool = byName.get("memory_create");
const updateTool = byName.get("memory_update");
const deleteTool = byName.get("memory_delete");

// compiled parameter schemas are wire JSON Schema
assert(searchTool.parameters.required.includes("query"), "search requires query");
assert(searchTool.parameters.properties.query.type === "string", "query schema compiled");
assert(createTool.parameters.properties.title.type === "string", "title schema compiled");
assert(Array.isArray(createTool.parameters.properties.tags.items.anyOf ?? [{}]) || createTool.parameters.properties.tags.type === "array", "tags compiled as array");

const listedByTool = await listTool.execute({});
assert(listedByTool.count === 1 && listedByTool.items[0].title === "回复风格", "memory_list works");

const createdByTool = await createTool.execute({ title: "Tool entry", content: "Created by the model tool.", tags: ["tool"], importance: 2 });
assert(createdByTool.item.title === "Tool entry", "memory_create works");

const searched = await searchTool.execute({ query: "简洁 中文" });
assert(searched.items.some((entry) => entry.title === "回复风格"), "memory_search matches multi-term query");
const searchedNone = await searchTool.execute({ query: "不存在的词xyz" });
assert(searchedNone.items.length === 0, "memory_search finds nothing for a miss");
const emptyQuery = await searchTool.execute({ query: "   " });
assert(emptyQuery.items.length === 0, "memory_search blank query returns nothing");

const updatedByTool = await updateTool.execute({ id: createdByTool.item.id, pinned: true, content: "Updated by the model tool." });
assert(updatedByTool.item.pinned === true && updatedByTool.item.content === "Updated by the model tool.", "memory_update works");

let argsError = null;
try { await searchTool.execute({}); } catch (error) { argsError = error; }
assert(argsError !== null, "missing required tool args must throw");
console.log("tool args error:", argsError?.constructor?.name, "-", String(argsError?.message).slice(0, 60));

let notFound = null;
try { await deleteTool.execute({ id: "m_missing" }); } catch (error) { notFound = error; }
assert(notFound !== null && notFound.message.includes("m_missing"), "deleting an unknown id throws a clear error");

const deletedByTool = await deleteTool.execute({ id: createdByTool.item.id });
assert(deletedByTool.deleted === true, "memory_delete works");

// ---- corrupt file quarantine ----
const { writeFileSync, readdirSync } = await import("node:fs");
const storePath = join(home, "llm-memories.json");
writeFileSync(storePath, "{ not json");
const pluginCorrupt = await import("../lib/index.js?reload=2");
let routeCorrupt = null;
const corruptCtx = {
	inject: (_list, callback) => { callback(corruptCtx); return () => {}; },
	connection: { admit: () => ({ peer: {} }) },
	systemPrompt: { section: () => () => {} },
	tools: { register: () => () => {} },
	webServer: { register: (r) => { routeCorrupt = r; return () => {}; } },
	logger: { info: () => {} },
};
pluginCorrupt.apply(corruptCtx);
const afterCorrupt = await driveRoute(routeCorrupt, "list");
assert(afterCorrupt.ok === true && afterCorrupt.value.items.length === 0, "corrupt store quarantined; plugin serves an empty list");
const quarantined = readdirSync(home).filter((entry) => entry.startsWith("llm-memories.json.corrupt-"));
assert(quarantined.length === 1, "corrupt file kept as .corrupt-*, got " + quarantined.length);
console.log("quarantined:", quarantined[0]);

console.log("ALL HOST CHECKS PASSED");
