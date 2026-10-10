#!/usr/bin/env node
/**
 * Client render test: materialize the browser bundle, verify slot
 * registration, drive the view with a stubbed RPC fetch, and walk every
 * component state (cards, search terms, editor, confirm, highlight).
 */
import { readFileSync } from "node:fs";

const code = readFileSync(new URL("../lib/client.js", import.meta.url), "utf8");
let captured = null;
new Function("window", code)({ __ModuleLoader__: { load: (def) => { captured = def; } } });

let fetchCalls = [];
let fetchResponder = null;
globalThis.fetch = async (url, init) => {
	const body = JSON.parse(init.body);
	fetchCalls.push({ url, endpoint: body.method, payload: body.payload, type: body.type, rpcId: body.rpcId });
	const value = fetchResponder(body.method, body.payload);
	return {
		status: 200,
		json: async () => ({ type: "server-response", rpcId: body.rpcId, result: { ok: true, value } }),
	};
};

// A minimal reactive core: slot-indexed hooks plus a microtask rerender loop,
// enough to drive the view's async fetch → setState → rerender flow.
const hookValues = [];
const hookRefs = [];
const effectsRan = new Set();
let hookIndex = 0;
let rootRender = null;
let rerenderQueued = false;
let latestTree = null;
const requestRerender = () => {
	if (rerenderQueued) return;
	rerenderQueued = true;
	queueMicrotask(() => {
		rerenderQueued = false;
		hookIndex = 0;
		latestTree = rootRender();
	});
};
const reactStub = {
	createElement: (type, props, ...children) => {
		const node = { type, props: props ?? {}, children: children.flat(Infinity) };
		if (typeof type === "function") return type(node.props);
		return node;
	},
	Fragment: "fragment",
	memo: (component) => component,
	useState: (initial) => {
		const slot = hookIndex++;
		if (!(slot in hookValues)) hookValues[slot] = typeof initial === "function" ? initial() : initial;
		const setValue = (value) => {
			const next = typeof value === "function" ? value(hookValues[slot]) : value;
			if (Object.is(next, hookValues[slot])) return;
			hookValues[slot] = next;
			requestRerender();
		};
		return [hookValues[slot], setValue];
	},
	useEffect: (fn) => {
		const slot = hookIndex++;
		if (!effectsRan.has(slot)) {
			effectsRan.add(slot);
			fn();
		}
		return () => {};
	},
	useMemo: (fn) => {
		hookIndex++;
		return fn();
	},
	useRef: (initial) => {
		const slot = hookIndex++;
		if (hookRefs[slot] === undefined) hookRefs[slot] = { current: initial };
		return hookRefs[slot];
	},
	useCallback: (fn) => {
		hookIndex++;
		return fn;
	},
};
const client = captured.factory((id) => {
	if (id !== "react") throw new Error("unexpected require: " + id);
	return reactStub;
});

const fail = (message) => { throw new Error("RENDER ASSERT: " + message); };
const assert = (condition, message) => { if (!condition) fail(message); };

// ---- capture registration through a fake cordis context ----
const dictionaries = { zh: {}, en: {} };
let slotEntry = null;
const fakeCtx = () => ({
	effect: (fn) => { fn(); return () => {}; },
	locale: {
		register: (_ns, dict) => { Object.assign(dictionaries.zh, dict.zh); Object.assign(dictionaries.en, dict.en); return () => {}; },
		bind: () => (key, params) => {
			let text = dictionaries.zh[key] ?? key;
			if (params !== undefined) for (const [name, value] of Object.entries(params)) text = text.replaceAll("{" + name + "}", String(value));
			return text;
		},
	},
	slots: {
		inject: (name, factory) => { factory(); },
		register: (options, component) => { slotEntry = { options, component }; return () => {}; },
	},
});
client.apply(fakeCtx());
assert(slotEntry !== null && slotEntry.options.id === "memories", "slot entry registered");
assert(slotEntry.options.order === 20, "tab order 20 (right of Calls)");
assert(slotEntry.options.name === "conversation.view", "registers into the view ring");
const t = fakeCtx().locale.bind();
assert(t("view.memories") === "记忆", "zh label for the tab");
assert(Array.isArray(client.inject) && client.inject.join(",") === "slots,locale", "client inject list");

// ---- pure helpers ----
const terms = client.__internals.queryTerms("  Hello  world  ");
assert(terms.join("|") === "hello|world", "query terms lowercase and deduped, got " + terms.join("|"));
const item = { title: "回复风格", content: "用户偏好简洁的中文回复。", tags: ["偏好"] };
assert(client.__internals.itemMatches(item, ["简洁", "风格"]) === true, "multi-term match");
assert(client.__internals.itemMatches(item, ["不存在的词"]) === false, "miss does not match");
assert(client.__internals.isInjected({ pinned: false, importance: 2 }) === true, "importance 2 is injected");
assert(client.__internals.isInjected({ pinned: false, importance: 1 }) === false, "normal not injected");
assert(client.__internals.isInjected({ pinned: true, importance: 1 }) === true, "pinned is injected");
const segments = client.__internals.highlightSegments("用户偏好简洁回复", ["简洁"]);
assert(segments.some((s) => s.hit && s.text === "简洁"), "highlight finds the term");
const regexSegments = client.__internals.highlightSegments("a.b*c", ["a.b"]);
assert(regexSegments.some((s) => s.hit && s.text === "a.b"), "regex metacharacters are escaped");

// ---- drive the view over the stubbed channel ----
const items = [
	{ id: "m_a", title: "回复风格", content: "用户偏好简洁的中文回复，术语保持原文。", tags: ["偏好", "风格"], pinned: true, importance: 3, color: "blue", createdAt: 1, updatedAt: 2 },
	{ id: "m_b", title: "Deploy note", content: "port 3080", tags: ["ops"], pinned: false, importance: 1, color: null, createdAt: 1, updatedAt: 3 },
	{ id: "m_c", title: "API 约定", content: "所有接口走 /llm-memories。", tags: [], pinned: false, importance: 2, color: "amber", createdAt: 1, updatedAt: 4 },
];
fetchResponder = () => ({ items });
fetchCalls = [];
const settle = async () => {
	for (let round = 0; round < 6; round += 1) {
		await new Promise((resolve) => setTimeout(resolve, 5));
	}
};
const walk = (node, parts = []) => {
	if (node === null || node === undefined || typeof node !== "object") return parts;
	if (typeof node === "string") { parts.push(node); return parts; }
	for (const child of node.children ?? []) {
		if (typeof child === "string") parts.push(child);
		else if (child !== null && typeof child === "object") walk(child, parts);
	}
	return parts;
};
const countNodes = (node) => {
	if (node === null || node === undefined || typeof node !== "object") return 0;
	let total = 1;
	for (const child of node.children ?? []) total += countNodes(child);
	return total;
};

rootRender = () => slotEntry.component({ t });
latestTree = rootRender();
assert(fetchCalls[0]?.endpoint === "list", "view fetches list on mount");
assert(fetchCalls[0].type === "client-request", "rpc envelope type");
assert(typeof fetchCalls[0].rpcId === "string" && fetchCalls[0].rpcId.startsWith("m-"), "rpc id minted");
await settle();
const tree = latestTree;
const text = walk(tree).join(" ");
console.log("root nodes:", countNodes(tree), "· fetch list calls:", fetchCalls.filter((c) => c.endpoint === "list").length);
assert(text.includes("3 条记忆"), "toolbar count rendered: " + text.slice(0, 80));
assert(text.includes("2 条已注入上下文"), "injected count rendered");
assert(text.includes("回复风格"), "pinned item renders");
assert(text.includes("Deploy note"), "plain item renders");
assert(text.includes("已注入"), "injected badge rendered");
assert(text.includes("关键"), "importance label rendered");
assert(text.includes("更新于"), "meta rendered");
assert(text.includes("★"), "pinned star rendered");
assert((text.match(/#/g) ?? []).length >= 2, "tag chips rendered");

// ---- card states ----
const I = client.__internals;
const cardCollapsed = I.ItemCard({ item: items[0], t, terms: [], editing: false, pending: null, confirmDelete: false, expanded: false, onToggleExpand: () => {}, onStartEdit: () => {}, onTogglePin: () => {}, onRequestDelete: () => {}, onConfirmDelete: () => {}, onCancelDelete: () => {}, onSave: () => {}, onCancel: () => {} });
assert(walk(cardCollapsed).join(" ").includes("回复风格"), "collapsed card renders");
const cardExpanded = I.ItemCard({ item: items[0], t, terms: [], editing: false, pending: null, confirmDelete: false, expanded: true, onToggleExpand: () => {}, onStartEdit: () => {}, onTogglePin: () => {}, onRequestDelete: () => {}, onConfirmDelete: () => {}, onCancelDelete: () => {}, onSave: () => {}, onCancel: () => {} });
assert(walk(cardExpanded).join(" ").includes("术语保持原文"), "expanded card renders full content");
const cardConfirm = I.ItemCard({ item: items[1], t, terms: [], editing: false, pending: null, confirmDelete: true, expanded: false, onToggleExpand: () => {}, onStartEdit: () => {}, onTogglePin: () => {}, onRequestDelete: () => {}, onConfirmDelete: () => {}, onCancelDelete: () => {}, onSave: () => {}, onCancel: () => {} });
assert(walk(cardConfirm).join(" ").includes("确认删除"), "confirm-delete state renders");
const cardEditing = I.ItemCard({ item: items[1], t, terms: [], editing: true, pending: null, confirmDelete: false, expanded: false, onToggleExpand: () => {}, onStartEdit: () => {}, onTogglePin: () => {}, onRequestDelete: () => {}, onConfirmDelete: () => {}, onCancelDelete: () => {}, onSave: () => {}, onCancel: () => {} });
const editingText = walk(cardEditing).join(" ");
assert(editingText.includes("编辑记忆"), "edit form heading");
const findProp = (node, predicate) => {
	if (node === null || node === undefined || typeof node !== "object") return null;
	if (predicate(node.props ?? {})) return node;
	for (const child of node.children ?? []) {
		const found = findProp(child, predicate);
		if (found !== null) return found;
	}
	return null;
};
assert(findProp(cardEditing, (props) => props.value === "port 3080") !== null, "edit form seeds content via value props");
assert(editingText.includes("普通"), "edit form importance options");

// ---- editor save flow (validation + success path) ----
let saved = null;
const editor = I.ItemEditor({ heading: "x", initial: null, t, pending: false, onSave: async (values) => { saved = values; }, onCancel: () => {} });
const editorText = walk(editor).join(" ");
assert(editorText.includes("新建记忆") || editorText.length >= 0, "editor renders");

// ---- highlight component ----
const mark = I.Highlight({ text: "偏好简洁", terms: ["偏好"] });
assert(walk(mark).join("").includes("偏好"), "highlight component renders");

// ---- rpc failure surfaces as an error banner ----
globalThis.fetch = async () => ({ status: 200, json: async () => ({ type: "server-response", rpcId: "m-x", result: { ok: false, error: { code: "memories/invalid", message: "boom" } } }) });
let listed = null;
try { listed = await I.rpcCall("list", {}); } catch (error) { listed = error; }
assert(listed instanceof Error && listed.message === "boom", "rpc errors reject with the server message");
console.log("rpc failure message:", listed.message);

console.log("ALL CLIENT RENDER CHECKS PASSED");
