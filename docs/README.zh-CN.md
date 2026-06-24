[English](../README.md)

# mpget

CLI 工具与 MCP 服务，用于搜索和获取微信公众号文章（基于搜狗微信搜索）。

专为 **AI Agent 集成** 设计 — 结构化 JSON 输出、MCP Server 支持、一键注入 Claude Code Skill。

## 功能特性

- **CLI + MCP 双模式** — 命令行工具 + MCP Server，适配多种 AI Agent
- **Agent Skill** — `mpget init` 一键注入 Skill 到 `.claude/skills/`，带版本同步
- **多页搜索** — 自动分页，支持配置最大页数和请求间隔
- **文章内容提取** — 获取并清洗微信公众号文章正文
- **结构化 JSON 输出** — 结果输出到 stdout，错误输出到 stderr，带类型化退出码

## 安装

```bash
npm install -g mpget
```

需要 Node.js >= 18。

## 使用方式

### CLI

```bash
# 搜索文章
mpget search "关键词"

# 指定页码
mpget search "关键词" -p 2

# 多页搜索（最多 5 页，间隔 1 秒）
mpget search "关键词" -a -m 5

# 获取文章内容
mpget content "https://mp.weixin.qq.com/s/xxx"
```

**搜索参数：**

| 参数             | 说明               | 默认值  |
| ---------------- | ------------------ | ------- |
| `-p, --page <n>` | 页码               | `1`     |
| `-a, --all`      | 获取全部页         | `false` |
| `-m, --max <n>`  | `--all` 时最大页数 | `10`    |

### MCP Server

```bash
mpget mcp
```

启动基于 stdio 的 MCP Server，提供两个工具：

- **`search`** — query, page, all, maxPages
- **`content`** — url, referer

兼容所有支持 MCP 协议的 Agent（Claude、Cursor 等）。

### Agent Skill（Claude Code）

```bash
mpget init
```

将 Skill 模板注入到 `.claude/skills/mpget.md`。Skill 包含版本同步机制 — Agent 每次使用时会检查 `mpget --version` 与 Skill 头部是否一致。

## 输出格式

所有命令将 JSON 输出到 stdout，错误以结构化 JSON 输出到 stderr。

**搜索结果：**

```json
{
  "results": [
    {
      "title": "文章标题",
      "link": "https://weixin.sogou.com/link?url=...",
      "publishTime": "2025-01-01"
    }
  ],
  "total": 10,
  "page": 1
}
```

**内容结果：**

```json
{
  "content": "文章正文..."
}
```

**退出码：**

| 退出码 | 含义               |
| ------ | ------------------ |
| `0`    | 成功               |
| `1`    | 反爬触发或网络错误 |
| `2`    | 参数错误           |

## 技术栈

- TypeScript, Node.js >= 18
- [commander](https://github.com/tj/commander.js) — CLI 框架
- [cheerio](https://github.com/cheeriojs/cheerio) — HTML 解析
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP Server
- 原生 `fetch` — 无额外 HTTP 依赖

## 开源协议

[AGPL-3.0](./LICENSE)
