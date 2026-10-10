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
