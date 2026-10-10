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
