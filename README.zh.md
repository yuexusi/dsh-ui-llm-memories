# dsh-ui-llm-memories

DSH（DeepSeek Harness）的跨会话持久记忆插件：在对话页「对话 / 轨迹 / 调用」右侧新增
**「记忆」**标签页，支持创建 / 删除 / 读取 / 查找 / 更改；重要记忆自动注入每次请求的
系统提示词，并提供五个 `memory_*` 工具让模型自主维护记忆。

## 功能

**记忆视图**（浏览器端）
- 全局一份记忆，所有工作区共用；条目带标题、正文、标签、重要度（普通/重要/关键）、
  置顶、颜色分类、创建/更新时间
- 顶栏实时关键词过滤（标题+正文+标签，大小写不敏感，命中高亮）
- 逐条展开全文；星标一键置顶；行内编辑与两步删除确认；刷新按钮
- 「已注入」徽标实时显示哪些条目会进入模型上下文
- 数据经宿主侧带鉴权的 `/llm-memories` JSON 通道持久化到 `~/.dsh/llm-memories.json`
  （原子写入；文件损坏时自动隔离并重建，数据不丢）

**上下文注入**（宿主侧）
- 每次模型请求前，置顶或重要度 ≥ 2 的记忆渲染成系统提示词的
  `## Long-term memory` 小节（先置顶，再按重要度/时间排序，上限 40 条 / 6000 字符）
- 普通记忆不注入，但模型可用工具随时检索

**模型工具**（宿主侧）
| 工具 | 说明 |
|---|---|
| `memory_list` | 列出全部记忆（含 240 字符内容预览） |
| `memory_search` | 多关键词 AND 检索（标题/正文/标签，返回全文） |
| `memory_create` | 新建记忆（标题、正文、标签、重要度、置顶） |
| `memory_update` | 按 id 更新（只改提供的字段） |
| `memory_delete` | 按 id 删除 |

## 安装（其他机器）

要求 DSH `>= 0.2.0-rc.2`。在目标 profile 目录（默认 `~/.dsh/profiles/web`）执行：

```sh
pnpm add github:yuexusi/dsh-ui-llm-memories
```

然后把包名加进 profile `package.json` 的 `dsh.profile.bundles` 列表：

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

重启 `dsh web`（若 manifest 里 `patchReload: "live"`，touch 一下 manifest 后刷新页面即可）。
新建一条记忆（比如置顶），发一句"你记得哪些关于我的事？"即可验证注入与工具。

## 文件结构

- `lib/index.js` — 宿主侧：存储、RPC 通道、提示词注入、模型工具
- `src/01-06*.js` — 浏览器 bundle 源码（`build.sh` 生成 `lib/client.js`）
- `cordis.patch.yml` — 组合条目（`- insert: llm-memories`）
- `test/host.mjs` — 宿主侧全流程测试（存储/RPC/注入/工具/持久化/损坏隔离）
- `test/render.mjs` — 浏览器端渲染与数据流测试
- `sync.sh` — 重建、同步进 profile、触发运行中宿主 live 重组

## 开发

```sh
./build.sh          # 重建浏览器 bundle
./sync.sh           # 同步到 profile 并触发热重组
node test/host.mjs     # 宿主侧测试
node test/render.mjs   # 浏览器端测试
```

本机开发位置：`/home/xusi/dsh-plugins/dsh-ui-llm-memories`（profile 依赖指向本地 `file:` 路径）。
profile 使用 hoisted linker，更新后必须 `sync.sh` 同步。

## 已知限制

- 记忆全局共享（所有工作区同一份）；按工作区分库暂不支持。
- 注入上限 40 条 / 6000 字符，超出部分模型需用 `memory_list` 检索。
- 存储为单文件 JSON，不做并发多进程锁（单宿主进程独占写入）。
- 颜色分类仅用于界面组织，模型看不到。

## 许可

[MIT](LICENSE)
