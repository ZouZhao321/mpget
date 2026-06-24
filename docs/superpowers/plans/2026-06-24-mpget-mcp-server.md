# mpget MCP Server 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 mpget 添加 MCP server 子命令，让 agent 可通过 MCP 协议直接调用搜索和内容获取功能。

**Architecture:** 新增 `src/commands/mcp.ts`，使用 `@modelcontextprotocol/sdk` 创建 stdio MCP server，暴露 `search` 和 `content` 两个 tool，直接复用 `fetcher.ts` 的函数。

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk ^1.0.0, vitest

---

## 文件变更总览

| 操作 | 文件                                | 职责                                   |
| ---- | ----------------------------------- | -------------------------------------- |
| 修改 | `package.json`                      | 新增 `@modelcontextprotocol/sdk` 依赖  |
| 创建 | `src/commands/mcp.ts`               | MCP server 子命令，tool 定义与 handler |
| 创建 | `src/commands/__test__/mcp.test.ts` | MCP tool handler 测试                  |
| 修改 | `src/index.ts`                      | 注册 `mcp` 子命令                      |

---

### Task 1: 安装 MCP SDK 依赖

**Files:**

- Modify: `package.json`

- [ ] **Step 1: 安装依赖**

```bash
pnpm add @modelcontextprotocol/sdk
```

- [ ] **Step 2: 验证安装成功**

```bash
pnpm ls @modelcontextprotocol/sdk
```

Expected: 显示已安装版本（>= 1.0.0）

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build: 添加 @modelcontextprotocol/sdk 依赖"
```

---

### Task 2: 实现 MCP tool handler（TDD）

**Files:**

- Create: `src/commands/__test__/mcp.test.ts`
- Create: `src/commands/mcp.ts`

- [ ] **Step 1: 写失败的测试**

创建 `src/commands/__test__/mcp.test.ts`：

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest"

// mock fetcher 模块
vi.mock("../../lib/fetcher.js", () => ({
  searchSogou: vi.fn(),
  searchSogouAll: vi.fn(),
  fetchArticleContent: vi.fn(),
}))

import { createMcpServer, __test__ } from "../mcp.js"
import { searchSogou, searchSogouAll, fetchArticleContent } from "../../lib/fetcher.js"

const mockSearch = vi.mocked(searchSogou)
const mockSearchAll = vi.mocked(searchSogouAll)
const mockContent = vi.mocked(fetchArticleContent)

describe("MCP tool handlers", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("search handler", () => {
    it("调用 searchSogou 并返回结果", async () => {
      const fakeResult = {
        query: "test",
        page: 1,
        results: [{ title: "T", link: "L", realUrl: "", publishTime: "P", page: "1" }],
      }
      mockSearch.mockResolvedValue(fakeResult)

      const result = await __test__.handleSearch({ query: "test" })

      expect(mockSearch).toHaveBeenCalledWith("test", 1, false)
      expect(result.isError).toBe(false)
      expect(JSON.parse(result.content[0].text)).toEqual(fakeResult)
    })

    it("all=true 时调用 searchSogouAll", async () => {
      mockSearchAll.mockResolvedValue([])

      const result = await __test__.handleSearch({ query: "q", all: true, maxPages: 3 })

      expect(mockSearchAll).toHaveBeenCalledWith("q", 3)
      expect(result.isError).toBe(false)
    })

    it("反爬触发时返回 isError", async () => {
      mockSearch.mockRejectedValue(new Error("ANTISPIDER"))

      const result = await __test__.handleSearch({ query: "test" })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("反爬")
    })

    it("网络错误时返回 isError", async () => {
      mockSearch.mockRejectedValue(new Error("NETWORK: timeout"))

      const result = await __test__.handleSearch({ query: "test" })

      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain("网络请求失败")
    })
  })

  describe("content handler", () => {
    it("调用 fetchArticleContent 并返回结果", async () => {
      mockContent.mockResolvedValue("文章正文")

      const result = await __test__.handleContent({ url: "https://mp.weixin.qq.com/s/xxx" })

      expect(mockContent).toHaveBeenCalledWith("https://mp.weixin.qq.com/s/xxx", undefined)
      expect(result.isError).toBe(false)
      expect(JSON.parse(result.content[0].text).content).toBe("文章正文")
    })

    it("传递 referer 参数", async () => {
      mockContent.mockResolvedValue("正文")

      await __test__.handleContent({
        url: "https://mp.weixin.qq.com/s/xxx",
        referer: "https://weixin.sogou.com",
      })

      expect(mockContent).toHaveBeenCalledWith(
        "https://mp.weixin.qq.com/s/xxx",
        "https://weixin.sogou.com",
      )
    })
  })

  describe("createMcpServer", () => {
    it("返回 Server 实例", () => {
      const server = createMcpServer()
      expect(server).toBeDefined()
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

```bash
pnpm test
```

Expected: `mcp.test.ts` 报错 `Cannot find module '../mcp.js'`

- [ ] **Step 3: 实现 MCP server**

创建 `src/commands/mcp.ts`：

```typescript
import { Server } from "@modelcontextprotocol/sdk/server/index.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js"
import { Command } from "commander"
import { searchSogou, searchSogouAll, fetchArticleContent } from "../lib/fetcher.js"
import { VERSION, CLI_NAME } from "../version.js"

async function handleSearch(
  args: Record<string, unknown>,
): Promise<{ isError: boolean; content: Array<{ type: "text"; text: string }> }> {
  const query = args.query as string
  const page = (args.page as number) ?? 1
  const all = (args.all as boolean) ?? false
  const maxPages = (args.maxPages as number) ?? 5

  try {
    const result = all
      ? { query, page: 1, results: await searchSogouAll(query, maxPages) }
      : await searchSogou(query, page)
    return { isError: false, content: [{ type: "text", text: JSON.stringify(result) }] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg === "ANTISPIDER")
      return { isError: true, content: [{ type: "text", text: "搜狗反爬机制触发，请稍后重试" }] }
    return { isError: true, content: [{ type: "text", text: `网络请求失败: ${msg}` }] }
  }
}

async function handleContent(
  args: Record<string, unknown>,
): Promise<{ isError: boolean; content: Array<{ type: "text"; text: string }> }> {
  const url = args.url as string
  const referer = args.referer as string | undefined

  try {
    const content = await fetchArticleContent(url, referer)
    return { isError: false, content: [{ type: "text", text: JSON.stringify({ url, content }) }] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { isError: true, content: [{ type: "text", text: `获取正文失败: ${msg}` }] }
  }
}

export function createMcpServer(): Server {
  const server = new Server({ name: CLI_NAME, version: VERSION }, { capabilities: { tools: {} } })

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "search",
        description: "搜索微信公众号文章",
        inputSchema: {
          type: "object" as const,
          properties: {
            query: { type: "string", description: "搜索关键词" },
            page: { type: "number", description: "页码，默认 1", default: 1 },
            all: { type: "boolean", description: "自动翻页", default: false },
            maxPages: { type: "number", description: "最大页数，all=true 时生效", default: 5 },
          },
          required: ["query"],
        },
      },
      {
        name: "content",
        description: "获取微信公众号文章正文",
        inputSchema: {
          type: "object" as const,
          properties: {
            url: { type: "string", description: "文章 URL" },
            referer: { type: "string", description: "请求来源" },
          },
          required: ["url"],
        },
      },
    ],
  }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params
    if (name === "search") return handleSearch(args ?? {})
    if (name === "content") return handleContent(args ?? {})
    throw new Error(`Unknown tool: ${name}`)
  })

  return server
}

export async function startMcpServer(): Promise<void> {
  const server = createMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

export const __test__ = { handleSearch, handleContent }

export function setupMcpCommand(program: Command): void {
  program
    .command("mcp")
    .description("启动 MCP server（stdio 模式）")
    .action(async () => {
      await startMcpServer()
    })
}
```

- [ ] **Step 4: 运行测试确认通过**

```bash
pnpm test
```

Expected: 所用例通过

- [ ] **Step 5: Commit**

```bash
git add src/commands/mcp.ts src/commands/__test__/mcp.test.ts
git commit -m "feat: 实现 MCP server 子命令，暴露 search 和 content tool"
```

---

### Task 3: 注册 MCP 子命令到 CLI 入口

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: 在 index.ts 中注册 mcp 命令**

在 `src/index.ts` 中添加 import 和注册调用：

```typescript
#!/usr/bin/env node
import { Command } from "commander"
import { VERSION, CLI_NAME } from "./version.js"
import { setupSearchCommand } from "./commands/search.js"
import { setupContentCommand } from "./commands/content.js"
import { setupInitCommand } from "./commands/init.js"
import { setupMcpCommand } from "./commands/mcp.js"

const program = new Command()
program.name(CLI_NAME).version(VERSION).description("微信公众号内容搜索与获取终端工具")
setupSearchCommand(program)
setupContentCommand(program)
setupInitCommand(program)
setupMcpCommand(program)
program.parse(process.argv)
```

- [ ] **Step 2: 运行全部测试**

```bash
pnpm test
```

Expected: 所有用例通过

- [ ] **Step 3: 构建验证**

```bash
pnpm build
```

Expected: 无编译错误，`dist/commands/mcp.js` 生成

- [ ] **Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: 注册 mcp 子命令到 CLI 入口"
```

---

### Task 4: 端到端验证

**Files:**

- 无新文件

- [ ] **Step 1: 验证 CLI help 包含 mcp**

```bash
node dist/index.js --help
```

Expected: 输出中包含 `mcp  启动 MCP server（stdio 模式）`

- [ ] **Step 2: 验证 MCP server 可启动（快速退出测试）**

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}}' | timeout 5 node dist/index.js mcp || true
```

Expected: 返回 JSON-RPC 响应，包含 `mpget` 和 `1.0.0`

- [ ] **Step 3: 最终 commit（如有修复）**

```bash
git add -A
git commit -m "chore: MCP server 端到端验证通过"
```
