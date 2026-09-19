import { Command } from "commander"
import { fetchAlbumArticles, fetchAlbumArticlesAll } from "../lib/album.js"

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
        const result = opts.all
          ? await fetchAlbumArticlesAll(biz, albumId, parseInt(opts.maxPages))
          : await fetchAlbumArticles({
              biz,
              albumId,
              count: parseInt(opts.count),
              beginMsgid: opts.beginMsgid,
              beginItemidx: opts.beginItemidx,
            })
        process.stdout.write(JSON.stringify(result) + "\n")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.startsWith("HTTP_") || msg.startsWith("NETWORK")) {
          process.stderr.write("网络请求失败\n")
        } else if (msg.startsWith("ALBUM_RET_")) {
          process.stderr.write("合集接口返回错误（可能需要登录）\n")
        } else {
          process.stderr.write(`错误: ${msg}\n`)
        }
        process.stdout.write(JSON.stringify({ error: "album", message: msg }) + "\n")
        process.exit(1)
      }
    })
}
