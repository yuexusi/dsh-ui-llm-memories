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
