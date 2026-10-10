# dsh-ui-llm-memories

Persistent cross-session memory for the [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH) Web client. It adds a **Memories** tab to the right of Chat / Trajectory / Calls in the conversation view — full create / read / search / update / delete in the browser, automatic system-prompt injection of important entries, and five `memory_*` tools the model can use to consult and maintain the store.

English | [中文](README.zh.md)

## Features

**Memories view** (browser)
- One global store shared across workspaces; entries carry title, content, tags, importance (normal / important / critical), pinned flag, color category, and timestamps.
- Live keyword filtering in the toolbar (title + content + tags, case-insensitive) with match highlighting.
- Expand full content per entry; one-click pin toggle; inline editor with two-step delete confirmation; manual refresh.
- An "Injected" badge shows which entries reach the model's context.
- All writes go through the authenticated host-side `/llm-memories` JSON channel and persist atomically to `~/.dsh/llm-memories.json` (a corrupt file is quarantined, never silently lost).

**Context injection** (host)
- Before every model request, pinned or importance ≥ 2 entries render into a `## Long-term memory` section of the system prompt (pinned first, then importance, then recency; capped at 40 entries / 6000 characters).
- Normal entries stay out of the prompt but remain reachable through the tools.

**Model tools** (host)
| Tool | Purpose |
|---|---|
| `memory_list` | List every entry (with a 240-character content preview). |
| `memory_search` | Multi-keyword AND search over title/content/tags, full content returned. |
| `memory_create` | Create an entry (title, content, tags, importance, pinned). |
| `memory_update` | Patch an entry by id; only provided fields change. |
| `memory_delete` | Delete an entry by id. |

## Install

Requires DSH `>= 0.2.0-rc.2`. From the target profile directory (`~/.dsh/profiles/web` unless your launcher says otherwise):

```sh
pnpm add github:yuexusi/dsh-ui-llm-memories
```

Then add the package to the `dsh.profile.bundles` list in the profile's `package.json`:

```json
"dsh": {
  "profile": {
    "bundles": [
      "@deepseek-ai/dsh-base",
      "@deepseek-ai/dsh-web-app",
      "dsh-ui-llm-memories"
    ]
  }
}
```

Restart `dsh web` (or, with `patchReload: "live"`, touch the manifest and refresh the page). Create a pinned entry, then ask the model "what do you remember about me?" to verify injection and tools.

## Development

```sh
./build.sh                # rebuild the browser bundle
./sync.sh                 # sync into the profile + live recompose
node test/host.mjs        # host-side flow tests
node test/render.mjs      # browser render + data-flow tests
```

## Known limits

- One global store for all workspaces; per-workspace scoping is not supported yet.
- Injection is capped (40 entries / 6000 chars); the model reads beyond it with `memory_list`.
- Single JSON file, single-writer (the one host process).
- The color category is UI-only; the model never sees it.

## License

[MIT](LICENSE)
