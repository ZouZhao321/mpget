import { describe, it, expect, vi, beforeEach } from "vitest"
import { readFileSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { fetchAlbumArticles, fetchAlbumArticlesAll } from "../album.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixtureDir = join(__dirname, "../../tests/fixtures")

function mockRes(url: string, json: unknown): Response {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(JSON.stringify(json)),
    json: () => Promise.resolve(json),
    url,
    headers: new Headers(),
    redirected: false,
    statusText: "OK",
    type: "basic" as const,
    clone: () => mockRes(url, json),
  } as Response
}

const albumJson = JSON.parse(readFileSync(join(fixtureDir, "album-real.json"), "utf-8"))

describe("fetchAlbumArticles", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("解析真实合集响应：文章列表 + 总数 + 翻页标记", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockRes("https://mp.weixin.qq.com/mp/appmsgalbum", albumJson)),
    )
    const r = await fetchAlbumArticles({ biz: "MzkxMTY4NTAyNQ==", albumId: "4371775694981152789" })
    expect(r.total).toBe("119")
    expect(r.continueFlag).toBe(1)
    expect(r.articles.length).toBeGreaterThan(0)
    const first = r.articles[0]
    expect(first.title.length).toBeGreaterThan(0)
    expect(first.createTime).toBeGreaterThan(0)
    // url 统一转 https
    expect(first.url).toMatch(/^https:\/\/mp\.weixin\.qq\.com\/s\?/)
  })

  it("非 0 ret 抛 ALBUM_RET_ 错误", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          mockRes("https://mp.weixin.qq.com/mp/appmsgalbum", { base_resp: { ret: -3 } }),
        ),
    )
    await expect(fetchAlbumArticles({ biz: "x", albumId: "y" })).rejects.toThrow("ALBUM_RET_-3")
  })
})

describe("fetchAlbumArticlesAll", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("翻页聚合直到 continue_flag 为 0", async () => {
    const page1 = {
      base_resp: { ret: 0 },
      getalbum_resp: {
        article_list: [
          {
            title: "A",
            create_time: "1",
            msgid: "100",
            itemidx: "1",
            url: "http://mp.weixin.qq.com/s?a",
          },
          {
            title: "B",
            create_time: "2",
            msgid: "99",
            itemidx: "1",
            url: "http://mp.weixin.qq.com/s?b",
          },
        ],
        base_info: { article_count: "3" },
        continue_flag: 1,
      },
    }
    const page2 = {
      base_resp: { ret: 0 },
      getalbum_resp: {
        article_list: [
          {
            title: "C",
            create_time: "3",
            msgid: "98",
            itemidx: "1",
            url: "http://mp.weixin.qq.com/s?c",
          },
        ],
        base_info: { article_count: "3" },
        continue_flag: 0,
      },
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(mockRes("u", page1))
      .mockResolvedValueOnce(mockRes("u", page2))
    vi.stubGlobal("fetch", fetchMock)
    const r = await fetchAlbumArticlesAll("biz", "album")
    expect(r.articles.map((a) => a.title)).toEqual(["A", "B", "C"])
    // 第二次请求携带上一页末条的翻页游标
    const secondUrl = fetchMock.mock.calls[1][0] as string
    expect(secondUrl).toContain("begin_msgid=99")
    expect(secondUrl).toContain("begin_itemidx=1")
  })
})
