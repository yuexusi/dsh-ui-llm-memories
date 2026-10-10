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
