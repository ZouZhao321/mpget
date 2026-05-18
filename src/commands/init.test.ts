import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, rm } from 'node:fs/promises';
import { installSkill } from './init.js';

describe('installSkill', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = mkdtempSync(join(tmpdir(), 'mpget-test-'));
    await mkdir(join(tempDir, '.claude'), { recursive: true });
  });
  afterEach(async () => await rm(tempDir, { recursive: true, force: true }));

  it('写入 skill 文件含版本号', () => {
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    installSkill(tempDir);
    const p = join(tempDir, '.claude', 'skills', 'mpget.md');
    expect(existsSync(p)).toBe(true);
    expect(readFileSync(p, 'utf-8')).toContain('cli_version: 1.0.0');
    spy.mockRestore();
  });

  it('自动创建 skills 目录', () => {
    const dir = mkdtempSync(join(tmpdir(), 'mpget-no-skills-'));
    installSkill(dir);
    expect(existsSync(join(dir, '.claude', 'skills', 'mpget.md'))).toBe(true);
  });
});
