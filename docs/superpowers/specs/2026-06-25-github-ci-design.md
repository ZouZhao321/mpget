# GitHub CI 设计

## 目标

为 mpget 项目添加 GitHub Actions CI，在 PR 合入前自动检查代码质量。

## 触发条件

- PR 到 `main` 分支
- push 到 `main` 分支

## 矩阵策略

| 运行环境 | 版本       |
| -------- | ---------- |
| Node.js  | 18, 20, 22 |
| pnpm     | 11         |

## Job 流程

单 job，按顺序执行以下步骤：

1. `actions/checkout@v4`
2. `pnpm/action-setup@v4` — 安装 pnpm
3. `actions/setup-node@v4` — 配置 Node.js 矩阵版本 + pnpm 缓存
4. `pnpm install --frozen-lockfile` — 安装依赖
5. `pnpm format:check` — Prettier 格式检查
6. `pnpm lint` — ESLint 检查
7. `pnpm build` — TypeScript 编译
8. `pnpm test` — Vitest 单元测试

任一步失败则 job 失败，三个 Node 版本并行运行。

## 文件

- `.github/workflows/ci.yml`
