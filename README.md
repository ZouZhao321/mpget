[中文](./docs/README.zh-CN.md)

# mpget

CLI tool and MCP server for searching and fetching WeChat Official Account articles via Sogou.

Designed for **agent integration** — structured JSON output, MCP server support, and one-command skill injection for Claude Code.

## Features

- **CLI + MCP dual interface** — use as a command-line tool or as an MCP server for AI agents
- **Agent Skill** — `mpget init` injects a skill file into `.claude/skills/` with version sync
- **Multi-page search** — automatic pagination with configurable max pages and rate limiting
- **Article content extraction** — fetches and cleans WeChat article body text
- **Structured JSON output** — all results to stdout, errors to stderr with typed exit codes

## Install

```bash
npm install -g mpget
```

Requires Node.js >= 18.

## Usage

### CLI

```bash
# Search articles
mpget search "key"

# Search with pagination
mpget search "key" -p 2

# Multi-page search (up to 5 pages, 1s interval)
mpget search "key" -a -m 5

# Fetch article content
mpget content "https://mp.weixin.qq.com/s/xxx"
```

**Search options:**

| Option | Description | Default |
|---|---|---|
| `-p, --page <n>` | Page number | `1` |
| `-a, --all` | Fetch all pages | `false` |
| `-m, --max <n>` | Max pages when `--all` | `10` |

### MCP Server

```bash
mpget mcp
```

Starts a stdio-based MCP server exposing two tools:

- **`search`** — query, page, all, maxPages
- **`content`** — url, referer

Compatible with any MCP-capable agent (Claude, Cursor, etc.).

### Agent Skill (Claude Code)

```bash
mpget init
```

Injects a skill template into `.claude/skills/mpget.md`. The skill includes version sync — the agent checks `mpget --version` against the skill header on each use.

## Output

All commands output JSON to stdout. Errors go to stderr as structured JSON.

**Search result:**

```json
{
  "results": [
    {
      "title": "Article Title",
      "link": "https://weixin.sogou.com/link?url=...",
      "publishTime": "2025-01-01"
    }
  ],
  "total": 10,
  "page": 1
}
```

**Content result:**

```json
{
  "content": "Article body text..."
}
```

**Exit codes:**

| Code | Meaning |
|---|---|
| `0` | Success |
| `1` | Anti-spider triggered or network error |
| `2` | Invalid arguments |

## Tech Stack

- TypeScript, Node.js >= 18
- [commander](https://github.com/tj/commander.js) — CLI framework
- [cheerio](https://github.com/cheeriojs/cheerio) — HTML parsing
- [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) — MCP server
- Native `fetch` — no extra HTTP dependencies

## License

[AGPL-3.0](./LICENSE)
