# mpget  — 微信公众号文章搜索 CLI + Agent Skill

## 概要

将 `weixin_search_mcp`（Python MCP 服务）迁移为 `mpget` 子命令（TypeScript CLI），并配套 Agent Skill 注入机制。CLI 内部使用 Node 原生 fetch + cheerio 爬取搜狗微信搜索结果和公众号文章正文。Skill 通过 `mpget init` 注入 `.claude/skills/`，含版本同步检查。

## 项目结构

```text
mpget/
├── src/
│   ├── index.ts              # 入口，commander root
│   ├── commands/
│   │   ├── search.ts          # mpget search
│   │   ├── content.ts         # mpget content
│   │   └── init.ts            # mpget init
│   ├── fetcher.ts             # fetch + cheerio 业务逻辑
│   └── version.ts             # 版本常量（从 package.json 注入）
├── skills/
│   └── mpget.md        # skill 模板
├── tsconfig.json
├── package.json               # bin: { "mpget": "./dist/index.js" }
└── README.md
```

## CLI 接口

Unix 风格子命令，机器优先输出。

### mpget search

```bash
mpget search <query>                 # 第 1 页
mpget search <query> -p <page>       # 指定页
mpget search <query> -a              # 全页（自动翻页，默认最多 5 页）
mpget search <query> -a -m <max>     # 全页限最多页
```

stdout JSON:

```json
{
  "query": "关键词",
  "page": 1,
  "results": [
    {
      "title": "...",
      "link": "https://weixin.sogou.com/...",
      "realUrl": "https://mp.weixin.qq.com/...",
      "publishTime": "2024-01-01"
    }
  ]
}
```

### mpget content

```bash
mpget content <url> [-r <referer>]
```

stdout JSON:

```json
{
  "url": "https://mp.weixin.qq.com/...",
  "content": "文章正文..."
}
```

### mpget init

```bash
mpget init
```

- 创建 `.claude/skills/`（如不存在）
- 写入 `wechat-mpget.md`（版本号从 package.json 注入）
- 提示 "Skill installed."

### mpget --version

```bash
mpget --version
# → mpget/1.0.0
```

## Agent 调用协议

| 场景 | exit code | stdout |
|------|-----------|--------|
| 正常 | 0 | JSON results |
| 反爬 | 1 | `{"error":"antispider","message":"..."}` |
| 网络错误 | 1 | `{"error":"network","message":"..."}` |
| 参数错误 | 2 | `{"error":"usage","message":"..."}` |
| 无结果 | 0 | `{"query":"...","results":[]}` |

stderr 纯日志，agent 不 parse。

## 版本同步机制

Agent 每次调 `mpget` 前执行：

1. 读 skill 头 `cli_version` 字段
2. 调 `mpget --version` 拿 CLI 实际版本
3. 比对
   - 一致 → 正常调命令
   - 不一致 → 先 `mpget init` 更新 skill，再继续

## Skill 模板

`skills/wechat-mpget.md` 结构：

```markdown
---
name: wechat-mpget
version: 1.0.0
cli_version: 1.0.0
---

# 微信公众号搜索工具

使用前调 `mpget --version` 检查版本，与 skill 头 cli_version 比对。
不一致先执行 `mpget init` 再继续。

## 命令

- `mpget search <query> [-p <page>] [-a] [-m <max>]`
- `mpget content <url> [-r <referer>]`
- `mpget init`

## Agent 规则

1. 用户问"搜公众号 XXX" → `mpget search <query>`
2. 需要最新文章 → `mpget search <query> -p 1`
3. 需要多页 → `mpget search <query> -a -m 5`
4. 需要正文 → 先 search 拿 realUrl，再 `mpget content <realUrl> [-r <link>]`
5. 反爬（exit 1, error antispider）→ 告知用户搜狗反爬
```

`mpget init` 注入时用 `package.json` 版本替换 `version` 和 `cli_version`。

## 依赖

| 包 | 用途 | 类型 |
|---|---|---|
| `commander` | CLI 框架 | runtime |
| `cheerio` | HTML 解析 | runtime |
| `typescript` | 编译 | devDeps |
| `@types/node` | TS 类型 | devDeps |

## 数据流

### search 流程

```bash
mpget search "AI"
  → Node fetch → GET https://weixin.sogou.com/weixin?type=2&query=AI&page=1
  → 反爬检测（URL/body 含 antispider/seccoderight/anti.min.css）
  → cheerio parse → 提取标题 + 搜狗链接 + 发布时间
  → 逐条 fetch 搜狗链接 → parse js 还原真实 mp 链接
  → stdout JSON
```

### content 流程

```bash
mpget content https://mp.weixin.qq.com/...
  → Node fetch → GET 文章页
  → cheerio $('#js_content').text()
  → stdout JSON
```

### 全页模式

```bash
循环 page=1..max_pages:
  → search 单页
  → 空结果 或 反爬 → break
  → 否则 sleep(1s)
  → 累计结果
→ stdout 合并 JSON
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 反爬 | exit 1, error antispider，无自动重试 |
| realUrl 解析失败 | 留空，不阻断整批结果 |
| content 拿不到 | error 字段描述原因 |
| 网络超时 | exit 1, error network |

## 测试策略（vitest）

- **单元测试**: mock fetch 返回固定 HTML，验证 cheerio parse 逻辑
- **CLI 测试**: commander parseAsync + 验证 stdout JSON 形状
- **Init 测试**: temp dir 验证 skill 文件写入和版本注入
- **Fixtures**: 录存搜狗结果页 HTML 和 mp.weixin.qq.com 文章 HTML
- **不测**: 真实网络请求（依赖外部搜狗，不可控）

## 非目标

- 不做 MCP server
- 不封装 HTTP 客户端（用 Node 原生 fetch）
- 不做自动反爬绕过（不维护 cookie 池/代理）
- 不做 Daemon/watch 模式
