import { Command } from "commander"
import { fetchArticleContent } from "../lib/fetcher.js"

export function setupContentCommand(program: Command): void {
  program
    .command("content <url>")
    .description("获取微信公众号文章正文")
    .option("-r, --referer <url>", "请求来源")
    .action(async (url, opts) => {
      try {
        const content = await fetchArticleContent(url, opts.referer)
        process.stdout.write(JSON.stringify({ url, content }) + "\n")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        process.stderr.write(`错误: ${msg}\n`)
        process.stdout.write(JSON.stringify({ url, content: "", error: msg }) + "\n")
        process.exit(1)
      }
    })
}
