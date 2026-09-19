export interface SearchResult {
  title: string
  link: string
  realUrl: string
  publishTime: string
  account: string
  page: string
}

export interface SearchResponse {
  query: string
  page: number
  results: SearchResult[]
}

export interface ContentResponse {
  url: string
  content: string
  error?: string
}

export interface ErrorResponse {
  error: "antispider" | "network" | "usage"
  message: string
}

export interface AlbumArticle {
  title: string
  createTime: number
  msgid: string
  itemidx: string
  url: string
}

export interface AlbumResponse {
  total: string
  continueFlag: number
  reverseContinueFlag: number
  articles: AlbumArticle[]
}
