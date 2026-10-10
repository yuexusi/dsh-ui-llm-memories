window.__ModuleLoader__.load({
	id: "dsh-ui-llm-memories",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		const react = require("react");
		const { useState, useEffect, useMemo, useRef, useCallback } = react;

		/** Hyperscript helper (no JSX in this hand-built bundle). */
		const h = (type, props, ...children) => react.createElement(type, props, ...children.flat());
		//#region locales
		/** Locale namespace of this plugin. */
		const NS = "llm-memories";
		const zh = {
			"view.memories": "记忆",
			"search.placeholder": "搜索标题、内容、标签…",
			"count.total": "{count} 条记忆",
			"count.injected": "{count} 条已注入上下文",
			"action.new": "新建",
			"action.refresh": "刷新",
			"action.edit": "编辑",
			"action.delete": "删除",
			"action.confirmDelete": "确认删除",
			"action.save": "保存",
			"action.cancel": "取消",
			"action.more": "展开全文",
			"action.less": "收起",
			"editor.newTitle": "新建记忆",
			"editor.editTitle": "编辑记忆",
			"editor.title": "标题",
			"editor.content": "内容",
			"editor.tags": "标签",
			"editor.tagsHint": "用逗号分隔，最多 12 个",
			"editor.importance": "重要度",
			"importance.1": "普通",
			"importance.2": "重要",
			"importance.3": "关键",
			"editor.pinned": "置顶",
			"editor.color": "颜色分类",
			"color.none": "无",
			"badge.injected": "已注入",
			"badge.pinned": "置顶",
			"empty.title": "还没有记忆",
			"empty.hint": "点「新建」添加一条，或者让 AI 用 memory_create 工具写入。",
			"empty.search": "没有匹配的记忆",
			"error.title": "操作失败",
			"loading": "加载中…",
			"meta.updatedAt": "更新于 {time}",
			"meta.createdAt": "创建于 {time}",
			"misc.required": "标题不能为空",
		};
		const en = {
			"view.memories": "Memories",
			"search.placeholder": "Search title, content, tags…",
			"count.total": "{count} memories",
			"count.injected": "{count} injected into context",
			"action.new": "New",
			"action.refresh": "Refresh",
			"action.edit": "Edit",
			"action.delete": "Delete",
			"action.confirmDelete": "Confirm delete",
			"action.save": "Save",
			"action.cancel": "Cancel",
			"action.more": "Expand",
			"action.less": "Collapse",
			"editor.newTitle": "New memory",
			"editor.editTitle": "Edit memory",
			"editor.title": "Title",
			"editor.content": "Content",
			"editor.tags": "Tags",
			"editor.tagsHint": "Comma separated, at most 12",
			"editor.importance": "Importance",
			"importance.1": "Normal",
			"importance.2": "Important",
			"importance.3": "Critical",
			"editor.pinned": "Pinned",
			"editor.color": "Color",
			"color.none": "None",
			"badge.injected": "Injected",
			"badge.pinned": "Pinned",
			"empty.title": "No memories yet",
			"empty.hint": "Click \"New\" to add one, or let the AI create it with the memory_create tool.",
			"empty.search": "No matching memories",
			"error.title": "Action failed",
			"loading": "Loading…",
			"meta.updatedAt": "Updated {time}",
			"meta.createdAt": "Created {time}",
			"misc.required": "Title must not be empty",
		};
		//#endregion
		//#region rpc and helpers
		/** Monotonic browser-side rpc id counter. */
		let rpcCounter = 0;

		/**
		 * Call one /llm-memories endpoint through the authenticated shared
		 * Connection channel. Document-relative: follows the page mount.
		 * @param endpoint - one of list/create/update/delete.
		 * @param payload - JSON payload for the endpoint.
		 * @returns the endpoint's value on success.
		 * @throws Error with the server's message otherwise.
		 */
		async function rpcCall(endpoint, payload) {
			const response = await fetch(`llm-memories/${endpoint}`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ type: "client-request", rpcId: `m-${(rpcCounter += 1)}`, method: endpoint, payload: payload ?? {} }),
			});
			const body = await response.json().catch(() => null);
			const result = body?.result;
			if (result?.ok === true) return result.value;
			throw new Error(result?.error?.message ?? `rpc ${endpoint} failed (${String(response.status)})`);
		}

		/** Split a query into lowercase search terms. */
		function queryTerms(query) {
			return query.trim().toLowerCase().split(/\s+/).filter((term) => term !== "");
		}

		/** Whether every term occurs in the item's searchable text. */
		function itemMatches(item, terms) {
			if (terms.length === 0) return true;
			const haystack = `${item.title}\n${item.content}\n${item.tags.join(" ")}`.toLowerCase();
			return terms.every((term) => haystack.includes(term));
		}

		/** Escape one literal string for embedding in a RegExp. */
		function escapeRegExp(text) {
			return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		/**
		 * Split one text into {text, hit} segments for highlight rendering.
		 * @param text - the text to split.
		 * @param terms - lowercase search terms.
		 */
		function highlightSegments(text, terms) {
			if (text === undefined || text === null) text = "";
			if (terms.length === 0) return [{ text: String(text), hit: false }];
			const pattern = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
			const segments = [];
			let lastIndex = 0;
			for (const match of String(text).matchAll(pattern)) {
				if (match.index > lastIndex) segments.push({ text: String(text).slice(lastIndex, match.index), hit: false });
				segments.push({ text: match[0], hit: true });
				lastIndex = match.index + match[0].length;
			}
			if (lastIndex < String(text).length) segments.push({ text: String(text).slice(lastIndex), hit: false });
			return segments;
		}

		/** Local date-time, minute precision. */
		function formatDateTime(time) {
			if (!Number.isFinite(time)) return "";
			const date = new Date(time);
			const pad = (value) => String(value).padStart(2, "0");
			return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
		}

		/** Entries injected into the model context: pinned or importance >= 2. */
		function isInjected(item) {
			return item.pinned === true || (item.importance ?? 1) >= 2;
		}

		/** Normalize a tags input (array or comma string) for the editor form. */
		function tagsToInput(tags) {
			return Array.isArray(tags) ? tags.join(", ") : "";
		}
		//#endregion
		//#region css
		const css =
			".dM9m_root{--dM9m-bottom-clearance:calc(var(--dsh-composer-height,152px) + 16px);width:100%;height:100%;min-height:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-1);flex-direction:column;display:flex;overflow:hidden}" +
			".dM9m_toolbar{z-index:4;box-sizing:border-box;border-bottom:.5px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);height:40px;flex:none;align-items:center;gap:8px;padding:0 10px 0 14px;display:flex}" +
			".dM9m_search{border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);height:24px;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);flex:0 240px;align-items:center;gap:5px;padding:0 8px;display:flex}" +
			".dM9m_search:focus-within{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-1)}" +
			".dM9m_searchInput{width:100%;min-width:0;font:var(--dsw-font-xxs-12);background:0 0;border:0;outline:0;padding:0}" +
			".dM9m_searchInput::placeholder{color:var(--dsw-alias-label-caption)}" +
			".dM9m_count{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xxs-12);user-select:none;white-space:nowrap;flex:none}" +
			".dM9m_countStrong{color:var(--dsw-alias-label-primary);font-weight:600}" +
			".dM9m_spacer{flex:1;min-width:0}" +
			".dM9m_button{border-radius:var(--dsw-radius-sm);height:24px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xxs-12);background:0 0;border:0;flex:none;align-items:center;gap:5px;padding:0 9px;display:inline-flex}" +
			".dM9m_button:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dM9m_button:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}" +
			".dM9m_button:disabled{cursor:default;opacity:.5}" +
			".dM9m_buttonPrimary{color:var(--dsw-alias-bg-layer-1);background:var(--dsw-alias-state-business-primary)}" +
			".dM9m_buttonPrimary:hover:not(:disabled){color:var(--dsw-alias-bg-layer-1);background:var(--dsw-alias-state-business-primary,--dsw-static-blue-600)}" +
			".dM9m_buttonDanger{color:var(--dsw-alias-state-error-primary)}" +
			".dM9m_list{flex:1;min-height:0;padding:8px calc(var(--dsh-composer-side-clearance,0px) + 16px) var(--dM9m-bottom-clearance);overflow-y:auto}" +
			".dM9m_inner{max-width:var(--dsh-chat-content-width,860px);flex-direction:column;gap:8px;width:100%;margin:0 auto;display:flex}" +
			".dM9m_empty{color:var(--dsw-alias-label-tertiary);flex-direction:column;align-items:center;gap:6px;padding:48px 0;text-align:center;display:flex}" +
			".dM9m_emptyTitle{color:var(--dsw-alias-label-secondary);font:var(--dsh-content-font-size,14px);font-weight:600}" +
			".dM9m_emptyHint{font:var(--dsh-content-font-size-secondary,13px);max-width:360px}" +
			".dM9m_error{border-radius:var(--dsw-radius-md);color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 8%,var(--dsw-alias-bg-layer-1));align-items:center;gap:8px;padding:8px 12px;display:flex}" +
			".dM9m_errorText{flex:1;min-width:0;font:var(--dsh-content-font-size-secondary,13px);overflow-wrap:anywhere}" +
			".dM9m_item{border:.5px solid var(--dsw-alias-border-l2);border-left:3px solid var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);flex-direction:column;min-width:0;display:flex;position:relative}" +
			".dM9m_item[data-pinned=true]{border-color:var(--dsw-alias-border-l3)}" +
			".dM9m_stripeBlue{border-left-color:var(--dsw-static-blue-500,--dsw-alias-state-business-primary)}" +
			".dM9m_stripeGreen{border-left-color:var(--dsw-alias-state-success-primary)}" +
			".dM9m_stripeAmber{border-left-color:var(--dsw-alias-state-warn-label)}" +
			".dM9m_stripeRed{border-left-color:var(--dsw-alias-state-error-primary)}" +
			".dM9m_stripeViolet{border-left-color:var(--dsw-static-violet-500,--dsw-alias-brand-primary-new-color,--dsw-static-blue-500)}" +
			".dM9m_itemHead{align-items:flex-start;gap:8px;padding:10px 12px 0 12px;display:flex}" +
			".dM9m_pin{flex:none;border:0;background:0 0;cursor:pointer;color:var(--dsw-alias-label-caption);font-size:13px;line-height:18px;padding:0}" +
			".dM9m_pin[data-on=true]{color:var(--dsw-alias-state-warn-label)}" +
			".dM9m_title{min-width:0;color:var(--dsw-alias-label-primary);font:600 var(--dsh-content-font-size,14px)/20px var(--ds-font-family);overflow-wrap:anywhere;flex:1}" +
			".dM9m_badge{box-sizing:border-box;border-radius:var(--dsw-radius-xs);user-select:none;flex:none;align-items:center;height:18px;padding:0 6px;font:600 10px/14px var(--ds-font-family-code);display:inline-flex}" +
			".dM9m_badgeInjected{color:var(--dsw-alias-state-success-primary);background:var(--dsw-alias-state-success-tertiary)}" +
			".dM9m_badgePinned{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary)}" +
			".dM9m_badgeImportance1{color:var(--dsw-alias-label-tertiary);background:var(--dsw-alias-bg-module-platform)}" +
			".dM9m_badgeImportance2{color:var(--dsw-alias-state-warn-label);background:var(--dsw-alias-state-warn-tertiary)}" +
			".dM9m_badgeImportance3{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 10%,var(--dsw-alias-bg-layer-1))}" +
			".dM9m_content{color:var(--dsw-alias-label-secondary);font:var(--dsh-content-font-size-secondary,13px)/20px var(--ds-font-family);white-space:pre-wrap;overflow-wrap:anywhere;padding:6px 12px 0 33px}" +
			".dM9m_content[data-clamped=true]{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;cursor:pointer;overflow:hidden}" +
			".dM9m_tags{flex-wrap:wrap;gap:4px;padding:6px 12px 0 33px;display:flex}" +
			".dM9m_tag{box-sizing:border-box;border-radius:100px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-interactive-bg-hover);font:11px/16px var(--ds-font-family-code);padding:1px 8px;white-space:nowrap}" +
			".dM9m_itemFoot{align-items:center;gap:6px;margin-top:8px;padding:0 12px 10px;display:flex}" +
			".dM9m_meta{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);user-select:none;white-space:nowrap;flex:none}" +
			".dM9m_footSpacer{flex:1;min-width:0}" +
			".dM9m_action{border-radius:var(--dsw-radius-sm);height:22px;color:var(--dsw-alias-label-tertiary);cursor:pointer;font:var(--dsw-font-xxs-12);background:0 0;border:0;flex:none;align-items:center;gap:4px;padding:0 7px;display:inline-flex}" +
			".dM9m_action:hover:not(:disabled){color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dM9m_actionDanger:hover:not(:disabled){color:var(--dsw-alias-state-error-primary);background:var(--dsw-alias-interactive-bg-hover)}" +
			".dM9m_action:disabled{cursor:default;opacity:.5}" +
			".dM9m_action:focus-visible{outline:1px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:1px}" +
			".dM9m_editor{border-bottom:.5px solid var(--dsw-alias-border-l2);flex-direction:column;gap:8px;background:var(--dsw-alias-bg-base);padding:12px 14px;display:flex}" +
			".dM9m_editorTitle{color:var(--dsw-alias-label-secondary);font:var(--dsw-font-xs-strong-13);user-select:none}" +
			".dM9m_fieldRow{align-items:center;gap:8px;display:flex}" +
			".dM9m_fieldLabel{color:var(--dsw-alias-label-tertiary);font:var(--dsw-font-xxs-12);user-select:none;width:56px;flex:none}" +
			".dM9m_input{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);width:100%;min-width:0;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:var(--dsh-content-font-size-secondary,13px)/20px var(--ds-font-family);padding:5px 9px}" +
			".dM9m_input:focus{border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-bg-layer-1);outline:0}" +
			".dM9m_textarea{resize:vertical;min-height:64px;font-family:var(--ds-font-family)}" +
			".dM9m_select{box-sizing:border-box;border:.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-layer-2);font:var(--dsh-content-font-size-secondary,13px);padding:4px 6px}" +
			".dM9m_select:focus{border-color:var(--dsw-alias-state-business-primary);outline:0}" +
			".dM9m_check{align-items:center;gap:5px;cursor:pointer;user-select:none;font:var(--dsw-font-xxs-12);color:var(--dsw-alias-label-secondary);display:inline-flex}" +
			".dM9m_hint{color:var(--dsw-alias-label-caption);font:11px/16px var(--ds-font-family-code)}" +
			".dM9m_editorError{color:var(--dsw-alias-state-error-primary);font:var(--dsw-font-xxs-12)}" +
			".dM9m_mark{background:color-mix(in srgb,var(--dsw-alias-state-warn-label) 22%,transparent);color:inherit;border-radius:2px;padding:0 1px}" +
			".dM9m_loading{color:var(--dsw-alias-label-tertiary);font:var(--dsh-content-font-size-secondary,13px);padding:36px 0;text-align:center}" +
			"@container (width<=560px){.dM9m_search{flex:1}.dM9m_count{display:none}.dM9m_fieldRow{flex-wrap:wrap}}";
		const cssTagId = "dsh-ui-llm-memories/styles.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(cssTagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-ui-llm-memories";
			tag.dataset.pluginCss = cssTagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		//#endregion
		//#region view components
		/** Compose one class name. */
		const cx = (...names) => names.filter(Boolean).join(" ");

		/** Render one text with the current search terms highlighted. */
		function Highlight({ text, terms }) {
			const segments = useMemo(() => highlightSegments(text, terms), [text, terms]);
			return h("span", null, segments.map((segment, index) =>
				segment.hit
					? h("mark", { key: index, className: cx("dM9m_mark") }, segment.text)
					: h(react.Fragment, { key: index }, segment.text),
			));
		}

		/** Create-or-edit form for one memory entry. */
		function ItemEditor({ heading, initial, t, pending, onSave, onCancel }) {
			const [title, setTitle] = useState(initial?.title ?? "");
			const [content, setContent] = useState(initial?.content ?? "");
			const [tags, setTags] = useState(tagsToInput(initial?.tags ?? []));
			const [importance, setImportance] = useState(String(initial?.importance ?? 1));
			const [pinned, setPinned] = useState(initial?.pinned === true);
			const [color, setColor] = useState(initial?.color ?? "");
			const [error, setError] = useState(null);
			const submit = async () => {
				if (title.trim() === "") {
					setError(t("misc.required"));
					return;
				}
				try {
					await onSave({ title, content, tags, importance: Number(importance), pinned, color: color === "" ? null : color });
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				}
			};
			return h("div", { className: cx("dM9m_editor") },
				h("div", { className: cx("dM9m_editorTitle") }, heading),
				h("div", { className: cx("dM9m_fieldRow") },
					h("label", { className: cx("dM9m_fieldLabel") }, t("editor.title")),
					h("input", { className: cx("dM9m_input"), value: title, maxLength: 200, autoFocus: true, onChange: (event) => setTitle(event.target.value), placeholder: t("editor.title") }),
				),
				h("div", { className: cx("dM9m_fieldRow") },
					h("label", { className: cx("dM9m_fieldLabel") }, t("editor.content")),
					h("textarea", { className: cx("dM9m_input", "dM9m_textarea"), value: content, onChange: (event) => setContent(event.target.value), placeholder: t("editor.content") }),
				),
				h("div", { className: cx("dM9m_fieldRow") },
					h("label", { className: cx("dM9m_fieldLabel") }, t("editor.tags")),
					h("input", { className: cx("dM9m_input"), value: tags, onChange: (event) => setTags(event.target.value), placeholder: t("editor.tagsHint") }),
				),
				h("div", { className: cx("dM9m_fieldRow") },
					h("label", { className: cx("dM9m_fieldLabel") }, t("editor.importance")),
					h("select", { className: cx("dM9m_select"), value: importance, onChange: (event) => setImportance(event.target.value) },
						h("option", { value: "1" }, t("importance.1")),
						h("option", { value: "2" }, t("importance.2")),
						h("option", { value: "3" }, t("importance.3")),
					),
					h("label", { className: cx("dM9m_check") },
						h("input", { type: "checkbox", checked: pinned, onChange: (event) => setPinned(event.target.checked) }),
						t("editor.pinned"),
					),
					h("label", { className: cx("dM9m_check") },
						t("editor.color"),
						h("select", { className: cx("dM9m_select"), value: color, onChange: (event) => setColor(event.target.value) },
							h("option", { value: "" }, t("color.none")),
							h("option", { value: "blue" }, "blue"),
							h("option", { value: "green" }, "green"),
							h("option", { value: "amber" }, "amber"),
							h("option", { value: "red" }, "red"),
							h("option", { value: "violet" }, "violet"),
						),
					),
				),
				error !== null ? h("div", { className: cx("dM9m_editorError") }, error) : null,
				h("div", { className: cx("dM9m_fieldRow") },
					h("button", { className: cx("dM9m_button", "dM9m_buttonPrimary"), type: "button", disabled: pending, onClick: submit }, pending ? t("loading") : t("action.save")),
					h("button", { className: cx("dM9m_button"), type: "button", disabled: pending, onClick: onCancel }, t("action.cancel")),
					h("span", { className: cx("dM9m_hint") }, t("editor.tagsHint")),
				),
			);
		}

		/** One memory card, or its inline editor while editing. */
		const ItemCard = react.memo(function ItemCard({ item, t, terms, editing, pending, confirmDelete, expanded, onToggleExpand, onStartEdit, onTogglePin, onRequestDelete, onConfirmDelete, onCancelDelete, onSave, onCancel }) {
			const importanceClass = `dM9m_badgeImportance${String(item.importance ?? 1)}`;
			return h("div", { className: cx("dM9m_item", item.color !== null && `dM9m_stripe${item.color !== null ? item.color[0].toUpperCase() + item.color.slice(1) : ""}`), "data-pinned": item.pinned === true },
				editing === true
					? h(ItemEditor, { heading: t("editor.editTitle"), initial: item, t, pending: pending === "save", onSave, onCancel })
					: h("div", null,
						h("div", { className: cx("dM9m_itemHead") },
							h("button", {
								type: "button",
								className: cx("dM9m_pin"),
								"data-on": item.pinned === true,
								title: t("editor.pinned"),
								disabled: pending === `pin:${item.id}`,
								onClick: () => onTogglePin(item),
							}, item.pinned === true ? "★" : "☆"),
							h("div", { className: cx("dM9m_title") }, h(Highlight, { text: item.title, terms })),
							isInjected(item) ? h("span", { className: cx("dM9m_badge", "dM9m_badgeInjected"), title: t("count.injected", { count: "" }) }, t("badge.injected")) : null,
							h("span", { className: cx("dM9m_badge", importanceClass) }, t(`importance.${String(item.importance ?? 1)}`)),
						),
						item.content !== "" ? h("div", {
							className: cx("dM9m_content"),
							"data-clamped": !expanded,
							onClick: () => onToggleExpand(item.id),
							title: expanded ? t("action.less") : t("action.more"),
						}, h(Highlight, { text: item.content, terms })) : null,
						item.tags.length > 0 ? h("div", { className: cx("dM9m_tags") },
							item.tags.map((tag) => h("span", { key: tag, className: cx("dM9m_tag") }, "#", h(Highlight, { text: tag, terms }))),
						) : null,
						h("div", { className: cx("dM9m_itemFoot") },
							h("span", { className: cx("dM9m_meta") }, t("meta.updatedAt", { time: formatDateTime(item.updatedAt) })),
							h("span", { className: cx("dM9m_footSpacer") }),
							h("button", { className: cx("dM9m_action"), type: "button", disabled: pending !== null, onClick: () => onStartEdit(item.id) }, t("action.edit")),
							confirmDelete === true
								? h("span", null,
									h("button", { className: cx("dM9m_action", "dM9m_actionDanger"), type: "button", disabled: pending === `delete:${item.id}`, onClick: () => onConfirmDelete(item.id) }, pending === `delete:${item.id}` ? t("loading") : t("action.confirmDelete")),
									h("button", { className: cx("dM9m_action"), type: "button", disabled: pending === `delete:${item.id}`, onClick: () => onCancelDelete(item.id) }, t("action.cancel")),
								)
								: h("button", { className: cx("dM9m_action", "dM9m_actionDanger"), type: "button", disabled: pending !== null, onClick: () => onRequestDelete(item.id) }, t("action.delete")),
						),
					),
			);
		});

		/** Root view: toolbar, search, ledger, and inline editors. */
		function MemoriesView({ t }) {
			const [items, setItems] = useState([]);
			const [loading, setLoading] = useState(true);
			const [error, setError] = useState(null);
			const [query, setQuery] = useState("");
			const [editor, setEditor] = useState(null);
			const [expandedIds, setExpandedIds] = useState(() => new Set());
			const [confirmId, setConfirmId] = useState(null);
			const [pending, setPending] = useState(null);

			const refresh = useCallback(async () => {
				setLoading(true);
				try {
					const value = await rpcCall("list");
					setItems(value.items ?? []);
					setError(null);
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setLoading(false);
				}
			}, []);

			useEffect(() => { void refresh(); }, [refresh]);

			const terms = useMemo(() => queryTerms(query), [query]);
			const visible = useMemo(() => items.filter((item) => itemMatches(item, terms)), [items, terms]);
			const injectedCount = useMemo(() => items.filter(isInjected).length, [items]);

			const toggleExpand = useCallback((id) => {
				setExpandedIds((current) => {
					const next = new Set(current);
					if (next.has(id)) next.delete(id);
					else next.add(id);
					return next;
				});
			}, []);

			const save = useCallback(async (id, values) => {
				setPending("save");
				try {
					if (id === null) await rpcCall("create", values);
					else await rpcCall("update", { id, patch: values });
					setEditor(null);
					setError(null);
					await refresh();
				} finally {
					setPending(null);
				}
			}, [refresh]);

			const togglePin = useCallback(async (item) => {
				setPending(`pin:${item.id}`);
				try {
					await rpcCall("update", { id: item.id, patch: { pinned: !(item.pinned === true) } });
					setError(null);
					await refresh();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setPending(null);
				}
			}, [refresh]);

			const confirmDelete = useCallback(async (id) => {
				setPending(`delete:${id}`);
				try {
					await rpcCall("delete", { id });
					setConfirmId(null);
					setError(null);
					await refresh();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setPending(null);
				}
			}, [refresh]);

			return h("div", { className: cx("dM9m_root"), "data-conversation-composer-overlay": "" },
				h("div", { className: cx("dM9m_toolbar") },
					h("div", { className: cx("dM9m_search") },
						h("input", {
							className: cx("dM9m_searchInput"),
							type: "search",
							value: query,
							placeholder: t("search.placeholder"),
							onChange: (event) => setQuery(event.target.value),
						}),
					),
					h("span", { className: cx("dM9m_count") },
						t("count.total", { count: String(items.length) }),
						injectedCount > 0 ? " · " + t("count.injected", { count: String(injectedCount) }) : "",
					),
					h("span", { className: cx("dM9m_spacer") }),
					h("button", { className: cx("dM9m_button"), type: "button", disabled: loading || pending !== null, onClick: () => { void refresh(); } }, t("action.refresh")),
					h("button", { className: cx("dM9m_button", "dM9m_buttonPrimary"), type: "button", disabled: pending !== null, onClick: () => { setEditor({ mode: "create" }); setConfirmId(null); } }, "+ " + t("action.new")),
				),
				h("div", { className: cx("dM9m_list") },
					h("div", { className: cx("dM9m_inner") },
						error !== null ? h("div", { className: cx("dM9m_error") },
							h("span", { className: cx("dM9m_errorText") }, t("error.title"), "：", error),
							h("button", { className: cx("dM9m_action"), type: "button", onClick: () => setError(null) }, "×"),
						) : null,
						editor !== null && editor.mode === "create"
							? h(ItemEditor, {
								key: "create",
								heading: t("editor.newTitle"),
								t,
								pending: pending === "save",
								onSave: (values) => save(null, values),
								onCancel: () => setEditor(null),
							})
							: null,
						loading && items.length === 0 && error === null
							? h("div", { className: cx("dM9m_loading") }, t("loading"))
							: null,
						!loading && items.length === 0 && editor === null && error === null
							? h("div", { className: cx("dM9m_empty") },
								h("div", { className: cx("dM9m_emptyTitle") }, t("empty.title")),
								h("div", { className: cx("dM9m_emptyHint") }, t("empty.hint")),
							)
							: null,
						!loading && items.length > 0 && visible.length === 0
							? h("div", { className: cx("dM9m_empty") }, h("div", { className: cx("dM9m_emptyHint") }, t("empty.search")))
							: null,
						visible.map((item) =>
							h(ItemCard, {
								key: item.id,
								item,
								t,
								terms,
								editing: editor !== null && editor.mode === "edit" && editor.id === item.id,
								pending,
								confirmDelete: confirmId === item.id,
								expanded: expandedIds.has(item.id),
								onToggleExpand: toggleExpand,
								onStartEdit: (id) => { setEditor({ mode: "edit", id }); setConfirmId(null); },
								onTogglePin: togglePin,
								onRequestDelete: (id) => { setConfirmId(id); setEditor(null); },
								onConfirmDelete: confirmDelete,
								onCancelDelete: () => setConfirmId(null),
								onSave: (values) => save(item.id, values),
								onCancel: () => setEditor(null),
							}),
						),
					),
				),
			);
		}
		//#endregion
		//#region plugin registration
		/** Services this client plugin waits for on the browser root context. */
		const inject = ["slots", "locale"];

		/** Install the Memories conversation view tab. */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "llm-memories: dictionaries");
			const t = ctx.locale.bind(NS);
			ctx.slots.inject("conversation.view", () =>
				ctx.slots.register(
					{
						name: "conversation.view",
						id: "memories",
						order: 20,
						locale: NS,
						label: () => t("view.memories"),
					},
					MemoriesView,
				),
			);
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		/** Test-only handles; never consumed by the loader. */
		exports.__internals = {
			MemoriesView,
			ItemCard,
			ItemEditor,
			Highlight,
			rpcCall,
			queryTerms,
			itemMatches,
			highlightSegments,
			isInjected,
		};
		return module.exports;
	},
});
