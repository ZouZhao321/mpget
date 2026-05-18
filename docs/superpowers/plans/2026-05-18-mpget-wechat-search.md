# mpget 微信公众号搜索 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate weixin_search_mcp into mpget CLI + Agent Skill.

**Architecture:** Single-package CLI in TypeScript. Commander for routing. Cheerio for HTML. Node native `fetch` for HTTP. Vitest for tests. `mpget init` injects skill into `.claude/skills/`.

**Tech Stack:** TypeScript 5+, Node 18+, Commander, Cheerio, Vitest

---

### Commit 1: 初始化项目脚手架与依赖

**Files:**
- Modify: `package.json`
- Create: `tsconfig.json`, `vitest.config.ts`

- [ ] Write `package.json`

```json
{
  "name": "mpget",
  "version": "1.0.0",
  "description": "微信公众号内容搜索与获取终端工具",
  "type": "module",
  "bin": { "mpget": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "cheerio": "^1.0.0",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  },
  "devEngines": {
    "packageManager": { "name": "pnpm", "version": "^11.0.9", "onFail": "download" }
  },
  "license": "ISC"
}
```

- [ ] Write `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "sourceMap": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] Write `vitest.config.ts`

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { globals: true, environment: 'node', include: ['src/**/*.test.ts'] },
});
```

- [ ] `pnpm install`

- [ ] Commit

```
chore: 初始化项目脚手架与依赖
```

---

### Commit 2: 添加类型定义、版本模块和目录结构

**Files:**
- Create: `src/lib/types.ts`, `src/version.ts`

Commit produces compilable code (no runtime behavior yet).

- [ ] Write `src/lib/types.ts`

```typescript
export interface SearchResult {
  title: string;
  link: string;
  realUrl: string;
  publishTime: string;
  page: string;
}

export interface SearchResponse {
  query: string;
  page: number;
  results: SearchResult[];
}

export interface ContentResponse {
  url: string;
  content: string;
  error?: string;
}

export interface ErrorResponse {
  error: 'antispider' | 'network' | 'usage';
  message: string;
}
```

- [ ] Write `src/version.ts`

```typescript
export const VERSION = '1.0.0';
export const CLI_NAME = 'mpget';
```

- [ ] `pnpm build` — 确认编译通过，无报错

- [ ] Commit

```
feat: 添加类型定义和版本模块
```

---

### Commit 3: 实现搜狗搜索、真实URL解析、正文提取核心逻辑

**Files:**
- Create: `src/lib/fetcher.ts`, `src/lib/fetcher.test.ts`
- Create: `tests/fixtures/sogou-search.html`, `tests/fixtures/sogou-redirect.html`

Commit includes: 搜狗搜索、反爬检测、realUrl 解析、正文提取、多页搜索。

- [ ] Write `tests/fixtures/sogou-search.html`

```html
<!DOCTYPE html>
<html><body>
<div class="results">
<li id="sogou_vr_11002601_box_0">
<div class="txt-box">
<a id="sogou_vr_11002601_title_0" href="/weixin?type=2&query=AI&redirect=true&url=abc123">AI文章标题1</a>
<div class="s-p"><span class="s2">2024-01-15</span></div>
</div>
</li>
<li id="sogou_vr_11002601_box_1">
<div class="txt-box">
<a id="sogou_vr_11002601_title_1" href="/weixin?type=2&query=AI&redirect=true&url=def456">AI文章标题2</a>
<div class="s-p"><span class="s2">2024-01-14</span></div>
</div>
</li>
</div>
</body></html>
```

- [ ] Write `tests/fixtures/sogou-redirect.html`

```html
<html><body><script>
var url = '';
url += 'weixin.qq.com/r/';
url += 'abc_def_123';
url += '@@';
</script></body></html>
```

- [ ] Write `src/lib/fetcher.ts`

```typescript
import * as cheerio from 'cheerio';
import type { SearchResponse, SearchResult } from './types.js';

const BASE = 'https://weixin.sogou.com/weixin';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0';
const TIMEOUT = 15_000;

function isAnti(url: string, body: string): boolean {
  const u = url.toLowerCase();
  const b = body.toLowerCase();
  return u.includes('antispider') || b.includes('seccoderight') || b.includes('anti.min.css');
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': UA,
    ...extra,
  };
}

export async function searchSogou(query: string, page = 1, strict = false): Promise<SearchResponse> {
  const params = new URLSearchParams({
    type: '2', s_from: 'input', query, ie: 'utf8',
    page: String(page), _sug_: 'n', _sug_type_: '',
  });
  const url = `${BASE}?${params}`;

  let res: Response;
  try { res = await fetchWithTimeout(url, { headers: headers({ Referer: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(query)}` }) }); }
  catch (e) {
    if (strict) throw new Error(`NETWORK: ${e instanceof Error ? e.message : String(e)}`);
    return { query, page, results: [] };
  }

  if (res.status !== 200) {
    if (strict) throw new Error(`HTTP_${res.status}`);
    return { query, page, results: [] };
  }

  const html = await res.text();
  if (isAnti(res.url, html)) throw new Error('ANTISPIDER');

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  $('a[id^="sogou_vr_11002601_title_"]').each((i, el) => {
    const $el = $(el);
    let link = $el.attr('href') ?? '';
    if (link && !link.startsWith('http')) link = `https://weixin.sogou.com${link}`;
    const pub = $(`li[id^="sogou_vr_11002601_box_"] .txt-box .s-p .s2`).eq(i).text().trim();
    results.push({ title: $el.text().trim(), link, realUrl: '', publishTime: pub, page: String(page) });
  });

  return { query, page, results };
}

export async function resolveRealUrl(sogouUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(sogouUrl, { headers: headers() });
    const html = await res.text();
    if (isAnti(res.url, html)) return '';
    const parts: string[] = [];
    const re = /url\s*\+=\s*'([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) parts.push(m[1]);
    return parts.length ? 'https://mp.' + parts.join('').replace(/@/g, '') : '';
  } catch { return ''; }
}

export async function fetchArticleContent(realUrl: string, referer?: string): Promise<string> {
  if (!realUrl || realUrl === 'https://mp.') return '获取文章内容失败: 未拿到有效的微信公众号文章链接';
  try {
    const hdrs = headers();
    if (referer) hdrs['Referer'] = referer;
    const res = await fetchWithTimeout(realUrl, { headers: hdrs });
    const $ = cheerio.load(await res.text());
    const text = $('#js_content').text().split(/\s+/).filter(Boolean).join('\n');
    return text || '获取文章内容失败: 正文为空';
  } catch (e) { return `获取文章内容失败: ${e instanceof Error ? e.message : String(e)}`; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function searchSogouAll(query: string, maxPages = 5): Promise<SearchResult[]> {
  const all: SearchResult[] = [];
  for (let p = 1; p <= maxPages; p++) {
    try {
      const r = await searchSogou(query, p, true);
      if (!r.results.length) break;
      all.push(...r.results);
      if (p < maxPages) await sleep(1000);
    } catch (e) {
      if ((e as Error).message?.startsWith('ANTISPIDER')) break;
      if (p === 1) throw e;
      break;
    }
  }
  return all;
}
```

- [ ] Write `src/lib/fetcher.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchSogou, resolveRealUrl, fetchArticleContent } from './fetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../../tests/fixtures');

function mockRes(url: string, html: string): Response {
  return { ok: true, status: 200, text: () => Promise.resolve(html), url, headers: new Headers(), redirected: false, statusText: 'OK', type: 'basic' as const, clone: () => mockRes(url, html) } as Response;
}

describe('searchSogou', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('解析搜索结果', async () => {
    const html = readFileSync(join(fixtureDir, 'sogou-search.html'), 'utf-8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/weixin?query=AI', html)));
    const r = await searchSogou('AI');
    expect(r.query).toBe('AI');
    expect(r.results).toHaveLength(2);
    expect(r.results[0].title).toBe('AI文章标题1');
    expect(r.results[1].publishTime).toBe('2024-01-14');
  });

  it('反爬检测', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/antispider/', 'antispider')));
    await expect(searchSogou('AI')).rejects.toThrow('ANTISPIDER');
  });

  it('空结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/weixin', '<html></html>')));
    const r = await searchSogou('AI');
    expect(r.results).toHaveLength(0);
  });
});

describe('resolveRealUrl', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('提取真实URL', async () => {
    const html = readFileSync(join(fixtureDir, 'sogou-redirect.html'), 'utf-8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/redirect', html)));
    expect(await resolveRealUrl('https://weixin.sogou.com/redirect')).toBe('https://mp.weixin.qq.com/r/abc_def_123');
  });

  it('反爬返回空', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/antispider/', 'antispider')));
    expect(await resolveRealUrl('https://weixin.sogou.com/redirect')).toBe('');
  });
});

describe('fetchArticleContent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('提取正文', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://mp.weixin.qq.com/s/test', '<div id="js_content">正文内容</div>')));
    expect(await fetchArticleContent('https://mp.weixin.qq.com/s/test')).toBe('正文内容');
  });

  it('无效URL', async () => {
    expect(await fetchArticleContent('https://mp.')).toBe('获取文章内容失败: 未拿到有效的微信公众号文章链接');
  });
});
```

- [ ] `pnpm test` — 确认 7 tests pass

- [ ] Commit

```
feat: 实现搜狗搜索、真实URL解析和正文提取
```

---

### Commit 4: 实现 search / content / init CLI 命令

**Files:**
- Create: `src/commands/search.ts`, `src/commands/content.ts`, `src/commands/init.ts`
- Create: `src/commands/search.test.ts`, `src/commands/content.test.ts`, `src/commands/init.test.ts`
- Create: `skills/mpget.md`

- [ ] Write `skills/mpget.md`

```markdown
---
name: mpget
version: 1.0.0
cli_version: 1.0.0
---

# 微信公众号搜索工具

使用前调 `mpget --version` 检查版本，与 skill 头 cli_version 比对。
不一致先执行 `mpget init` 更新 skill，再继续。

## 命令

- `mpget search <query> [-p <page>] [-a] [-m <max>]`
- `mpget content <url> [-r <referer>]`
- `mpget init`
- `mpget --version`

## Agent 规则

1. 用户问"搜公众号 XXX" → `mpget search <query>`
2. 需要多页 → `mpget search <query> -a -m 5`
3. 需要正文 → 先 search 拿 realUrl，再 `mpget content <realUrl>`
4. 反爬（exit 1, error antispider）→ 告知用户搜狗反爬
5. 版本不对 → 先 `mpget init` 再继续
```

- [ ] Write `src/commands/search.ts`

```typescript
import { Command } from 'commander';
import { searchSogou, searchSogouAll } from '../lib/fetcher.js';

export function setupSearchCommand(program: Command): void {
  program
    .command('search <query>')
    .description('搜索微信公众号文章')
    .option('-p, --page <number>', '页码', '1')
    .option('-a, --all', '全页自动翻页')
    .option('-m, --max-pages <number>', '最大页数', '5')
    .action(async (query, opts) => {
      try {
        const result = opts.all
          ? { query, page: 1, results: await searchSogouAll(query, parseInt(opts.maxPages)) }
          : await searchSogou(query, parseInt(opts.page));
        process.stdout.write(JSON.stringify(result) + '\n');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.startsWith('ANTISPIDER')) { process.stderr.write('搜狗反爬触发\n'); process.stdout.write(JSON.stringify({ error: 'antispider', message: msg }) + '\n'); process.exit(1); }
        if (msg.startsWith('NETWORK') || msg.startsWith('HTTP_')) { process.stderr.write('网络请求失败\n'); process.stdout.write(JSON.stringify({ error: 'network', message: msg }) + '\n'); process.exit(1); }
        process.stderr.write(`错误: ${msg}\n`); process.stdout.write(JSON.stringify({ error: 'antispider', message: msg }) + '\n'); process.exit(1);
      }
    });
}
```

- [ ] Write `src/commands/content.ts`

```typescript
import { Command } from 'commander';
import { fetchArticleContent } from '../lib/fetcher.js';

export function setupContentCommand(program: Command): void {
  program
    .command('content <url>')
    .description('获取微信公众号文章正文')
    .option('-r, --referer <url>', '请求来源')
    .action(async (url, opts) => {
      try {
        const content = await fetchArticleContent(url, opts.referer);
        process.stdout.write(JSON.stringify({ url, content }) + '\n');
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`错误: ${msg}\n`);
        process.stdout.write(JSON.stringify({ url, content: '', error: msg }) + '\n');
        process.exit(1);
      }
    });
}
```

- [ ] Write `src/commands/init.ts`

```typescript
import { Command } from 'commander';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSION } from '../version.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_SRC = join(__dirname, '../../skills/mpget.md');

export function setupInitCommand(program: Command, cwd?: string): void {
  program
    .command('init')
    .description('安装 mpget skill 到 .claude/skills/')
    .action(() => {
      const base = cwd ?? process.env.INIT_CWD ?? process.cwd();
      const skillsD = join(base, '.claude', 'skills');
      if (!existsSync(skillsD)) mkdirSync(skillsD, { recursive: true });
      const content = readFileSync(SKILL_SRC, 'utf-8')
        .replace(/^version: .+$/m, `version: ${VERSION}`)
        .replace(/^cli_version: .+$/m, `cli_version: ${VERSION}`);
      writeFileSync(join(skillsD, 'mpget.md'), content, 'utf-8');
      process.stdout.write(`mpget skill → .claude/skills/mpget.md\n`);
    });
}
```

- [ ] Write `src/commands/search.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { setupSearchCommand } from './search.js';

describe('search command', () => {
  let program: Command;
  beforeEach(() => { program = new Command(); setupSearchCommand(program); });

  it('注册 search 子命令', () => { expect(program.commands.find(c => c.name() === 'search')).toBeDefined(); });
  it('接受 -p 参数', () => { expect(program.commands.find(c => c.name() === 'search')?.options.find(o => o.short === '-p')).toBeDefined(); });
  it('接受 -a 和 -m 参数', () => {
    const cmd = program.commands.find(c => c.name() === 'search')!;
    expect(cmd.options.find(o => o.short === '-a')).toBeDefined();
    expect(cmd.options.find(o => o.short === '-m')).toBeDefined();
  });
});
```

- [ ] Write `src/commands/content.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { Command } from 'commander';
import { setupContentCommand } from './content.js';

describe('content command', () => {
  let program: Command;
  beforeEach(() => { program = new Command(); setupContentCommand(program); });

  it('注册 content 子命令', () => { expect(program.commands.find(c => c.name() === 'content')).toBeDefined(); });
  it('接受 -r 参数', () => { expect(program.commands.find(c => c.name() === 'content')?.options.find(o => o.short === '-r')).toBeDefined(); });
  it('需要 url 参数', () => { expect(program.commands.find(c => c.name() === 'content')?.args?.some(a => a.required)).toBeTruthy(); });
});
```

- [ ] Write `src/commands/init.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, rm } from 'node:fs/promises';
import { Command } from 'commander';
import { setupInitCommand } from './init.js';

describe('init command', () => {
  let tempDir: string, program: Command;
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mpget-test-'));
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    program = new Command();
    setupInitCommand(program, tempDir);
  });
  afterEach(async () => await rm(tempDir, { recursive: true, force: true }));

  it('注册 init 子命令', () => { expect(program.commands.find(c => c.name() === 'init')).toBeDefined(); });

  it('写入 skill 文件含版本号', async () => {
    const cmd = program.commands.find(c => c.name() === 'init')!;
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    // Commander stores action as a private property on Command instance. This needs the actual program.parse flow.
    // Instead, test through the action function directly or verify file output.
    // For now, use the actual action
    const action = (cmd as any)._actionHandler;
    await action();
    const p = join(tempDir, '.claude', 'skills', 'mpget.md');
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, 'utf-8')).toContain('cli_version: 1.0.0');
    spy.mockRestore();
  });
});
```

- [ ] `pnpm test` — 确认全部通过

- [ ] Commit

```
feat: 实现 search/content/init 命令和 skill 模板
```

---

### Commit 5: 整合入口点

**Files:**
- Create: `src/index.ts`

- [ ] Write `src/index.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION, CLI_NAME } from './version.js';
import { setupSearchCommand } from './commands/search.js';
import { setupContentCommand } from './commands/content.js';
import { setupInitCommand } from './commands/init.js';

const program = new Command();
program.name(CLI_NAME).version(VERSION).description('微信公众号内容搜索与获取终端工具');
setupSearchCommand(program);
setupContentCommand(program);
setupInitCommand(program);
program.parse(process.argv);
```

- [ ] `pnpm build` — 确认 dist/index.js 生成

- [ ] Smoke test: `node ./dist/index.js --help` → 输出帮助信息

- [ ] Smoke test: `node ./dist/index.js --version` → `1.0.0`

- [ ] `pnpm test` — 全部通过

- [ ] Commit

```
feat: 整合入口点，完成 mpget CLI
```
