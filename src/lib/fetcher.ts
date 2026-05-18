import * as cheerio from 'cheerio';
import type { SearchResponse, SearchResult } from './types.js';

const BASE = 'https://weixin.sogou.com/weixin';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36 Edg/137.0.0.0';
const TIMEOUT = 15_000;

function isAnti(url: string, body: string): boolean {
  const u = url.toLowerCase();
  const b = body.toLowerCase();
  return u.includes('antispider') || b.includes('seccoderight') || b.includes('anti.min.css');
}

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT);
  try { return await fetch(url, { ...init, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  return {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    'User-Agent': UA,
    ...extra,
  };
}

export async function searchSogou(query: string, page = 1, strict = false): Promise<SearchResponse> {
  const params = new URLSearchParams({
    type: '2', s_from: 'input', query, ie: 'utf8',
    page: String(page), _sug_: 'n', _sug_type_: '',
  });
  const url = `${BASE}?${params}`;

  let res: Response;
  try { res = await fetchWithTimeout(url, { headers: headers({ Referer: `https://weixin.sogou.com/weixin?query=${encodeURIComponent(query)}` }) }); }
  catch (e) {
    if (strict) throw new Error(`NETWORK: ${e instanceof Error ? e.message : String(e)}`);
    return { query, page, results: [] };
  }

  if (res.status !== 200) {
    if (strict) throw new Error(`HTTP_${res.status}`);
    return { query, page, results: [] };
  }

  const html = await res.text();
  if (isAnti(res.url, html)) throw new Error('ANTISPIDER');

  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  $('a[id^="sogou_vr_11002601_title_"]').each((i, el) => {
    const $el = $(el);
    let link = $el.attr('href') ?? '';
    if (link && !link.startsWith('http')) link = `https://weixin.sogou.com${link}`;
    const pub = $(`li[id^="sogou_vr_11002601_box_"] .txt-box .s-p .s2`).eq(i).text().trim();
    results.push({ title: $el.text().trim(), link, realUrl: '', publishTime: pub, page: String(page) });
  });

  return { query, page, results };
}

export async function resolveRealUrl(sogouUrl: string): Promise<string> {
  try {
    const res = await fetchWithTimeout(sogouUrl, { headers: headers() });
    const html = await res.text();
    if (isAnti(res.url, html)) return '';
    const parts: string[] = [];
    const re = /url\s*\+=\s*'([^']+)'/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) parts.push(m[1]);
    return parts.length ? 'https://mp.' + parts.join('').replace(/@/g, '') : '';
  } catch { return ''; }
}

export async function fetchArticleContent(realUrl: string, referer?: string): Promise<string> {
  if (!realUrl || realUrl === 'https://mp.') return '获取文章内容失败: 未拿到有效的微信公众号文章链接';
  try {
    const hdrs = headers();
    if (referer) hdrs['Referer'] = referer;
    const res = await fetchWithTimeout(realUrl, { headers: hdrs });
    const $ = cheerio.load(await res.text());
    const text = $('#js_content').text().split(/\s+/).filter(Boolean).join('\n');
    return text || '获取文章内容失败: 正文为空';
  } catch (e) { return `获取文章内容失败: ${e instanceof Error ? e.message : String(e)}`; }
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

export async function searchSogouAll(query: string, maxPages = 5): Promise<SearchResult[]> {
  const all: SearchResult[] = [];
  for (let p = 1; p <= maxPages; p++) {
    try {
      const r = await searchSogou(query, p, true);
      if (!r.results.length) break;
      all.push(...r.results);
      if (p < maxPages) await sleep(1000);
    } catch (e) {
      if ((e as Error).message?.startsWith('ANTISPIDER')) break;
      if (p === 1) throw e;
      break;
    }
  }
  return all;
}
