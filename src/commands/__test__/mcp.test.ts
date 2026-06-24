import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/fetcher.js', () => ({
  searchSogou: vi.fn(),
  searchSogouAll: vi.fn(),
  fetchArticleContent: vi.fn(),
}));

import { createMcpServer, __test__ } from '../mcp.js';
import { searchSogou, searchSogouAll, fetchArticleContent } from '../../lib/fetcher.js';

const mockSearch = vi.mocked(searchSogou);
const mockSearchAll = vi.mocked(searchSogouAll);
const mockContent = vi.mocked(fetchArticleContent);

describe('MCP tool handlers', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('search handler', () => {
    it('调用 searchSogou 并返回结果', async () => {
      const fakeResult = { query: 'test', page: 1, results: [{ title: 'T', link: 'L', realUrl: '', publishTime: 'P', page: '1' }] };
      mockSearch.mockResolvedValue(fakeResult);
      const result = await __test__.handleSearch({ query: 'test' });
      expect(mockSearch).toHaveBeenCalledWith('test', 1, true);
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text)).toEqual(fakeResult);
    });

    it('all=true 时调用 searchSogouAll', async () => {
      mockSearchAll.mockResolvedValue([]);
      const result = await __test__.handleSearch({ query: 'q', all: true, maxPages: 3 });
      expect(mockSearchAll).toHaveBeenCalledWith('q', 3);
      expect(result.isError).toBe(false);
    });

    it('反爬触发时返回 isError', async () => {
      mockSearch.mockRejectedValue(new Error('ANTISPIDER'));
      const result = await __test__.handleSearch({ query: 'test' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('反爬');
    });

    it('网络错误时返回 isError', async () => {
      mockSearch.mockRejectedValue(new Error('NETWORK: timeout'));
      const result = await __test__.handleSearch({ query: 'test' });
      expect(mockSearch).toHaveBeenCalledWith('test', 1, true);
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('网络请求失败');
    });
  });

  describe('content handler', () => {
    it('调用 fetchArticleContent 并返回结果', async () => {
      mockContent.mockResolvedValue('文章正文');
      const result = await __test__.handleContent({ url: 'https://mp.weixin.qq.com/s/xxx' });
      expect(mockContent).toHaveBeenCalledWith('https://mp.weixin.qq.com/s/xxx', undefined);
      expect(result.isError).toBe(false);
      expect(JSON.parse(result.content[0].text).content).toBe('文章正文');
    });

    it('传递 referer 参数', async () => {
      mockContent.mockResolvedValue('正文');
      await __test__.handleContent({ url: 'https://mp.weixin.qq.com/s/xxx', referer: 'https://weixin.sogou.com' });
      expect(mockContent).toHaveBeenCalledWith('https://mp.weixin.qq.com/s/xxx', 'https://weixin.sogou.com');
    });

    it('fetchArticleContent 返回错误字符串时 isError 为 true', async () => {
      mockContent.mockResolvedValue('获取文章内容失败: 正文为空');
      const result = await __test__.handleContent({ url: 'https://mp.weixin.qq.com/s/xxx' });
      expect(result.isError).toBe(true);
    });

    it('fetchArticleContent 抛出异常时返回 isError', async () => {
      mockContent.mockRejectedValue(new Error('network boom'));
      const result = await __test__.handleContent({ url: 'https://example.com' });
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('获取文章内容失败');
    });
  });

  describe('createMcpServer', () => {
    it('返回 Server 实例', () => {
      const server = createMcpServer();
      expect(server).toBeDefined();
    });
  });
});
