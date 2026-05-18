# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 操作此仓库时提供指引。

## Karpathy 编码准则

1. **先想再写** — 明确假设再动手，不确定就问，不猜
2. **保持简单** — 最小代码解决问题，无超前抽象，200 行能 50 行则重写
3. **手术刀式修改** — 只动该动的，不改周围代码，不重构未坏之物
4. **目标驱动** — 先定义验证标准再执行，写 test 复现 bug 再修

## 快速导航

- 常用命令 → `package.json` scripts
- 技术栈 → `package.json` dependencies
- 部署配置 → `cloudbaserc.json`

## Git 规范

- 提交格式：`type(scope): 中文描述` — 遵循 Conventional Commits
- type: feat / fix / chore / docs / refactor / style / test
- 分支命名：`type/description`（如 `feat/dark-mode`）
- Worktree 命名：匹配分支名去掉 `type/` 前缀（如 `feat/dark-mode` → `dark-mode`）
