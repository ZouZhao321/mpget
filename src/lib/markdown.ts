import * as cheerio from "cheerio"
import TurndownService from "turndown"
import { gfm } from "@joplin/turndown-plugin-gfm"

const turndown = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  linkStyle: "inlined",
})

turndown.use(gfm)
turndown.remove(["script", "style"])

export function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html)
  const content = $("#js_content")

  // 微信正文的图片真实地址在 data-src，src 常是 data: 占位图；地址与 alt 的 Markdown 转义由 turndown 处理
  content.find("img").each((_, el) => {
    const img = $(el)
    const src = img.attr("data-src") || img.attr("src") || ""
    if (src && !src.startsWith("data:")) img.attr("src", src)
    else img.remove()
  })

  const markup = content.html()
  if (!markup) return ""
  return turndown.turndown(markup).trim()
}
