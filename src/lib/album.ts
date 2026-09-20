import { fetchWithTimeout, headers } from "./fetcher.js"
import type { AlbumArticle, AlbumResponse } from "./types.js"

const ALBUM_URL = "https://mp.weixin.qq.com/mp/appmsgalbum"

export interface AlbumParams {
  biz: string
  albumId: string
  count?: number
  beginMsgid?: string
  beginItemidx?: string
}

function isSuccessData(data: Record<string, unknown>): boolean {
  const base = data.base_resp as { ret?: number } | undefined
  return base?.ret === 0
}

function normalizeUrl(url: string): string {
  return url.replace(/^http:\/\//, "https://")
}

export async function fetchAlbumArticles(params: AlbumParams): Promise<AlbumResponse> {
  const count = Math.min(20, Math.max(1, params.count ?? 10))
  const search = new URLSearchParams({
    action: "getalbum",
    scene: "1",
    f: "json",
    __biz: params.biz,
    album_id: params.albumId,
    count: String(count),
  })
  if (params.beginMsgid !== undefined) search.set("begin_msgid", params.beginMsgid)
  if (params.beginItemidx !== undefined) search.set("begin_itemidx", params.beginItemidx)

  let res: Response
  try {
    res = await fetchWithTimeout(`${ALBUM_URL}?${search}`, {
      headers: headers({ Referer: "https://mp.weixin.qq.com/" }),
    })
  } catch (e) {
    throw new Error(`NETWORK: ${e instanceof Error ? e.message : String(e)}`, { cause: e })
  }
  if (res.status !== 200) throw new Error(`HTTP_${res.status}`)

  const data = (await res.json()) as Record<string, unknown>
  if (!isSuccessData(data))
    throw new Error(`ALBUM_RET_${(data.base_resp as { ret?: number })?.ret}`)

  const resp = data.getalbum_resp as Record<string, unknown> | undefined
  const list = (resp?.article_list as Array<Record<string, unknown>> | undefined) ?? []
  const baseInfo = (resp?.base_info as Record<string, unknown> | undefined) ?? {}

  const articles: AlbumArticle[] = list.map((a) => ({
    title: String(a.title ?? ""),
    createTime: Number(a.create_time ?? 0),
    msgid: String(a.msgid ?? ""),
    itemidx: String(a.itemidx ?? ""),
    url: normalizeUrl(String(a.url ?? "")),
  }))

  return {
    total: String(baseInfo.article_count ?? ""),
    continueFlag: Number(resp?.continue_flag ?? 0),
    reverseContinueFlag: Number(resp?.reverse_continue_flag ?? 0),
    articles,
  }
}

export interface AlbumAllParams {
  maxPages?: number
  count?: number
  beginMsgid?: string
  beginItemidx?: string
}

export async function fetchAlbumArticlesAll(
  biz: string,
  albumId: string,
  opts: AlbumAllParams = {},
): Promise<AlbumResponse> {
  const maxPages = opts.maxPages ?? 50
  let beginMsgid: string | undefined = opts.beginMsgid
  let beginItemidx: string | undefined = opts.beginItemidx
  let total = ""
  let lastContinue = 1
  const all: AlbumArticle[] = []

  for (let page = 1; page <= maxPages; page++) {
    const r = await fetchAlbumArticles({
      biz,
      albumId,
      count: opts.count ?? 10,
      beginMsgid,
      beginItemidx,
    })
    if (r.total) total = r.total
    lastContinue = r.continueFlag
    if (!r.articles.length) {
      lastContinue = 0
      break
    }
    all.push(...r.articles)
    if (!r.continueFlag) break
    const last = r.articles[r.articles.length - 1]
    beginMsgid = last.msgid
    beginItemidx = last.itemidx
  }

  return { total, continueFlag: lastContinue, reverseContinueFlag: 0, articles: all }
}
