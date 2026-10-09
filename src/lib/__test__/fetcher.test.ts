import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { searchSogou, resolveRealUrl, fetchArticleContent } from "../fetcher.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, "../../tests/fixtures")

function mockRes(url: string, html: string): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(html),
    url,
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic" as const,
    clone: () => mockRes(url, html),
  } as Response
}

describe("searchSogou", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("解析真实搜索结果（公众号名 + timeConvert 时间戳）", async () => {
    const html = readFileSync(join(fixtureDir, "sogou-search-real.html"), "utf-8")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://weixin.sogou.com/weixin?query=AI", html)),
    )
    const r = await searchSogou("AI")
    expect(r.results.length).toBeGreaterThan(0)
    const first = r.results[0]
    expect(first.title.length).toBeGreaterThan(0)
    // 公众号名来自 .all-time-y2，不再为空
    expect(first.account).toBe("CFD之道")
    // publishTime 由 timeConvert 时间戳转换而来，不再是一段 script 源码
    expect(first.publishTime).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(first.publishTime).not.toContain("timeConvert")
  })

  it("反爬检测", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://weixin.sogou.com/antispider/", "antispider")),
    )
    await expect(searchSogou("AI")).rejects.toThrow("ANTISPIDER")
  })

  it("空结果", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://weixin.sogou.com/weixin", "<html></html>")),
    )
    const r = await searchSogou("AI")
    expect(r.results).toHaveLength(0)
  })
})

describe("resolveRealUrl", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("真实 /link 页面：首段已含 https://mp. 前缀，不再重复拼接", async () => {
    const html = readFileSync(join(fixtureDir, "sogou-redirect-real.html"), "utf-8")
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://weixin.sogou.com/link?url=test", html)),
    )
    const url = await resolveRealUrl("https://weixin.sogou.com/link?url=test")
    expect(url).toMatch(/^https:\/\/mp\.weixin\.qq\.com\/s\?src=11/)
    expect(url).not.toContain("https://mp.https://")
  })

  it("反爬返回空", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://weixin.sogou.com/antispider/", "antispider")),
    )
    expect(await resolveRealUrl("https://weixin.sogou.com/redirect")).toBe("")
  })
})

describe("fetchArticleContent", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("提取正文", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockRes("https://mp.weixin.qq.com/s/test", '<div id="js_content">正文内容</div>'),
        ),
    )
    expect(await fetchArticleContent("https://mp.weixin.qq.com/s/test")).toBe("正文内容")
  })

  it("无效URL", async () => {
    expect(await fetchArticleContent("https://mp.")).toBe(
      "获取文章内容失败: 未拿到有效的微信公众号文章链接",
    )
  })

  it("正文按 Markdown 返回，保留标题、列表、代码块、图片、引用与表格", async () => {
    const html = readFileSync(join(fixtureDir, "article-content.html"), "utf-8")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes("https://mp.weixin.qq.com/s/a", html)))

    const md = await fetchArticleContent("https://mp.weixin.qq.com/s/a")

    expect(md).toContain("### 小标题")
    expect(md).toContain("第一段**加粗**文字。")
    expect(md).toContain("-   条目一")
    expect(md).toContain("> 引用一段话")
    expect(md).toContain("```\nnpm install -g mpget\n```")
    expect(md).toContain("| 列 A | 列 B |")
    expect(md).toContain("末尾*斜体*结束。")
  })

  it("图片取 data-src，跳过 data: 占位图", async () => {
    const html = readFileSync(join(fixtureDir, "article-content.html"), "utf-8")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes("https://mp.weixin.qq.com/s/b", html)))

    const md = await fetchArticleContent("https://mp.weixin.qq.com/s/b")

    expect(md).toContain("![示意图](https://mmbiz.qpic.cn/mmbiz_png/abc/0?wx_fmt=png)")
    expect(md).not.toContain("data:image/gif")
  })

  it("排除 script/style 与 js_content 之外的内容", async () => {
    const html = readFileSync(join(fixtureDir, "article-content.html"), "utf-8")
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockRes("https://mp.weixin.qq.com/s/c", html)))

    const md = await fetchArticleContent("https://mp.weixin.qq.com/s/c")

    expect(md).not.toContain("脚本内容不该出现在正文里")
    expect(md).not.toContain("display: none")
    expect(md).not.toContain("正文之外的噪声")
  })

  it("没有 js_content 时返回失败提示", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://mp.weixin.qq.com/s/d", "<div>没有正文</div>")),
    )
    expect(await fetchArticleContent("https://mp.weixin.qq.com/s/d")).toBe(
      "获取文章内容失败: 正文为空",
    )
  })
})
