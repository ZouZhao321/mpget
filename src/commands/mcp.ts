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
      : await searchSogou(query, page, true)
    return { isError: false, content: [{ type: "text", text: JSON.stringify(result) }] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    if (msg.startsWith("ANTISPIDER"))
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
    const isError = content.startsWith("获取文章内容失败")
    return { isError, content: [{ type: "text", text: JSON.stringify({ url, content }) }] }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { isError: true, content: [{ type: "text", text: `获取文章内容失败: ${msg}` }] }
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
