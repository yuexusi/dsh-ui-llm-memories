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
