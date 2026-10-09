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

// 微信正文的图片真实地址在 data-src，src 常是 data: 占位图
turndown.addRule("wechatImage", {
  filter: "img",
  replacement: (_content, node) => {
    const el = node as unknown as { getAttribute(name: string): string | null }
    const src = el.getAttribute("data-src") || el.getAttribute("src") || ""
    if (!src || src.startsWith("data:")) return ""
    const alt = el.getAttribute("alt") || ""
    return `![${alt}](${src})`
  },
})

export function htmlToMarkdown(html: string): string {
  const $ = cheerio.load(html)
  const content = $("#js_content").html()
  if (!content) return ""
  return turndown.turndown(content).trim()
}
