import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchSogou, resolveRealUrl, fetchArticleContent } from './fetcher.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtureDir = join(__dirname, '../../tests/fixtures');

function mockRes(url: string, html: string): Response {
  return { ok: true, status: 200, text: () => Promise.resolve(html), url, headers: new Headers(), redirected: false, statusText: 'OK', type: 'basic' as const, clone: () => mockRes(url, html) } as Response;
}

describe('searchSogou', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('解析搜索结果', async () => {
    const html = readFileSync(join(fixtureDir, 'sogou-search.html'), 'utf-8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/weixin?query=AI', html)));
    const r = await searchSogou('AI');
    expect(r.query).toBe('AI');
    expect(r.results).toHaveLength(2);
    expect(r.results[0].title).toBe('AI文章标题1');
    expect(r.results[1].publishTime).toBe('2024-01-14');
  });

  it('反爬检测', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/antispider/', 'antispider')));
    await expect(searchSogou('AI')).rejects.toThrow('ANTISPIDER');
  });

  it('空结果', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/weixin', '<html></html>')));
    const r = await searchSogou('AI');
    expect(r.results).toHaveLength(0);
  });
});

describe('resolveRealUrl', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('提取真实URL', async () => {
    const html = readFileSync(join(fixtureDir, 'sogou-redirect.html'), 'utf-8');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/redirect', html)));
    expect(await resolveRealUrl('https://weixin.sogou.com/redirect')).toBe('https://mp.weixin.qq.com/r/abc_def_123');
  });

  it('反爬返回空', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://weixin.sogou.com/antispider/', 'antispider')));
    expect(await resolveRealUrl('https://weixin.sogou.com/redirect')).toBe('');
  });
});

describe('fetchArticleContent', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('提取正文', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockRes('https://mp.weixin.qq.com/s/test', '<div id="js_content">正文内容</div>')));
    expect(await fetchArticleContent('https://mp.weixin.qq.com/s/test')).toBe('正文内容');
  });

  it('无效URL', async () => {
    expect(await fetchArticleContent('https://mp.')).toBe('获取文章内容失败: 未拿到有效的微信公众号文章链接');
  });
});
