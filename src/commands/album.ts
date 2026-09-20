import { Command } from "commander"
import { fetchAlbumArticles, fetchAlbumArticlesAll } from "../lib/album.js"

function parsePositiveInt(value: string, name: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`USAGE: ${name} 必须为正整数`)
  return n
}

export function setupAlbumCommand(program: Command): void {
  program
    .command("album <biz> <albumId>")
    .description("获取公众号合集内的文章列表（含真实文章链接）")
    .option("-c, --count <number>", "每页条数（服务端上限 20）", "10")
    .option("--begin-msgid <number>", "翻页起点 msgid（上一页末条）")
    .option("--begin-itemidx <number>", "翻页起点 itemidx（上一页末条）")
    .option("-a, --all", "自动翻页拉取整个合集")
    .option("-m, --max-pages <number>", "自动翻页的最大页数", "50")
    .action(async (biz, albumId, opts) => {
      try {
        if (!biz || !albumId) throw new Error("USAGE: biz 与 albumId 不能为空")
        const count = parsePositiveInt(opts.count, "--count")
        const maxPages = parsePositiveInt(opts.maxPages, "--max-pages")
        const result = opts.all
          ? await fetchAlbumArticlesAll(biz, albumId, {
              maxPages,
              count,
              beginMsgid: opts.beginMsgid,
              beginItemidx: opts.beginItemidx,
            })
          : await fetchAlbumArticles({
              biz,
              albumId,
              count,
              beginMsgid: opts.beginMsgid,
              beginItemidx: opts.beginItemidx,
            })
        process.stdout.write(JSON.stringify(result) + "\n")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.startsWith("USAGE")) {
          process.stderr.write("参数错误\n")
          process.stdout.write(JSON.stringify({ error: "usage", message: msg }) + "\n")
        } else if (msg.startsWith("NETWORK")) {
          process.stderr.write("网络请求失败\n")
          process.stdout.write(JSON.stringify({ error: "network", message: msg }) + "\n")
        } else if (msg.startsWith("HTTP_")) {
          process.stderr.write("网络请求失败\n")
          process.stdout.write(JSON.stringify({ error: "network", message: msg }) + "\n")
        } else if (msg.startsWith("ALBUM_RET_")) {
          process.stderr.write("合集接口返回错误（可能需要登录）\n")
          process.stdout.write(JSON.stringify({ error: "album", message: msg }) + "\n")
        } else {
          process.stderr.write(`错误: ${msg}\n`)
          process.stdout.write(JSON.stringify({ error: "album", message: msg }) + "\n")
        }
        process.exit(1)
      }
    })
}
