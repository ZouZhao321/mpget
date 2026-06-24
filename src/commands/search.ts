import { Command } from "commander"
import { searchSogou, searchSogouAll } from "../lib/fetcher.js"

export function setupSearchCommand(program: Command): void {
  program
    .command("search <query>")
    .description("搜索微信公众号文章")
    .option("-p, --page <number>", "页码", "1")
    .option("-a, --all", "全页自动翻页")
    .option("-m, --max-pages <number>", "最大页数", "5")
    .action(async (query, opts) => {
      try {
        const result = opts.all
          ? { query, page: 1, results: await searchSogouAll(query, parseInt(opts.maxPages)) }
          : await searchSogou(query, parseInt(opts.page))
        process.stdout.write(JSON.stringify(result) + "\n")
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        if (msg.startsWith("ANTISPIDER")) {
          process.stderr.write("搜狗反爬触发\n")
          process.stdout.write(JSON.stringify({ error: "antispider", message: msg }) + "\n")
          process.exit(1)
        }
        if (msg.startsWith("NETWORK") || msg.startsWith("HTTP_")) {
          process.stderr.write("网络请求失败\n")
          process.stdout.write(JSON.stringify({ error: "network", message: msg }) + "\n")
          process.exit(1)
        }
        process.stderr.write(`错误: ${msg}\n`)
        process.stdout.write(JSON.stringify({ error: "antispider", message: msg }) + "\n")
        process.exit(1)
      }
    })
}
