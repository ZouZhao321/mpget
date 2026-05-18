---
name: mpget
version: 1.0.0
cli_version: 1.0.0
---

# 微信公众号搜索工具

使用前调 `mpget --version` 检查版本，与 skill 头 cli_version 比对。
不一致先执行 `mpget init` 更新 skill，再继续。

## 命令

- `mpget search <query> [-p <page>] [-a] [-m <max>]`
- `mpget content <url> [-r <referer>]`
- `mpget init`
- `mpget --version`

## Agent 规则

1. 用户问"搜公众号 XXX" → `mpget search <query>`
2. 需要多页 → `mpget search <query> -a -m 5`
3. 需要正文 → 先 search 拿 realUrl，再 `mpget content <realUrl>`
4. 反爬（exit 1, error antispider）→ 告知用户搜狗反爬
5. 版本不对 → 先 `mpget init` 再继续
