# mpget MCP Server 设计文档

日期：2026-06-24

## 目标

为 mpget 添加 MCP (Model Context Protocol) server，作为 `mpget mcp` 子命令运行，让支持 MCP 的 agent 可以直接调用 mpget 的搜索和内容获取能力，无需通过 CLI 命令行。

## 架构

新增 `src/commands/mcp.ts`，使用 `@modelcontextprotocol/sdk` 创建 stdio MCP server，直接 import `fetcher.ts` 的函数。

```
src/
├── commands/
│   ├── mcp.ts      # 新增：MCP server 子命令
│   ├── search.tsY
│   ├── content.ts
│   └── init.ts
├── lib/
│   ├── fetcher.ts   # 不变
│   └── types.ts     # 不变
└── index.ts          # 注册 mcp 子命令
```

`package.json` 新增依赖：`@modelcontextprotocol/sdk`（^1.0.0）

CLI 入口 `mpget mcp` 启动 stdio server，暴露两个 tool。

## Tool 定义

### Tool 1: `search`

| 参数       | 类型    | 必填 | 默认值 | 说明                        |
| ---------- | ------- | ---- | ------ | --------------------------- |
| `query`    | string  | 是   | —      | 搜索关键词                  |
| `page`     | number  | 否   | 1      | 页码                        |
| `all`      | boolean | 否   | false  | 自动翻页                    |
| `maxPages` | number  | 否   | 5      | 最大页数（all=true 时生效） |

返回 JSON：`SearchResponse` 或 `ErrorResponse`

### Tool 2: `content`

| 参数      | 类型   | 必填 | 默认值 | 说明                           |
| --------- | ------ | ---- | ------ | ------------------------------ |
| `url`     | string | 是   | —      | 文章 URL（搜狗链接或微信链接） |
| `referer` | string | 否   | —      | 请求来源                       |

返回 JSON：`ContentResponse`

两个 tool 直接调用 `searchSogou`/`searchSogouAll` 和 `fetchArticleContent`，输出格式与 CLI 一致。

## 错误处理

| 场景               | MCP 处理方式                                                      |
| ------------------ | ----------------------------------------------------------------- |
| 反爬触发           | tool 返回 `isError: true`，内容：`"搜狗反爬机制触发，请稍后重试"` |
| 网络超时/HTTP 错误 | tool 返回 `isError: true`，内容：`"网络请求失败: <具体错误>"`     |
| 参数错误           | MCP SDK 自动校验，返回 schema 错误                                |

错误不抛异常，统一通过 tool result 的 `isError` 字段返回，和 CLI 的 JSON 错误输出对齐。

## 测试

- `src/commands/__test__/mcp.test.ts` — 测试 MCP tool 注册和调用
- mock `fetch` 全局对象，复用现有 HTML fixture
- 验证：search tool 返回正确结构、content tool 返回正文、反爬场景返回 isError
- 不需要启动真实 MCP server，直接测试 tool handler 函数

## 非目标

- 不修改现有 CLI 命令行为
- 不暴露 `init` 命令为 MCP tool
- 不自动解析搜狗链接为微信真实 URL（保持与 CLI 一致）
- 不实现 HTTP/SSE transport（仅 stdio）
