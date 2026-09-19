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
})
