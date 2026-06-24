import { Command } from "commander"
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { VERSION } from "../version.js"

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILL_SRC = join(__dirname, "../../skills/mpget.md")

export function installSkill(baseDir: string): void {
  const skillsD = join(baseDir, ".claude", "skills")
  if (!existsSync(skillsD)) mkdirSync(skillsD, { recursive: true })
  const content = readFileSync(SKILL_SRC, "utf-8")
    .replace(/^version: .+$/m, `version: ${VERSION}`)
    .replace(/^cli_version: .+$/m, `cli_version: ${VERSION}`)
  writeFileSync(join(skillsD, "mpget.md"), content, "utf-8")
  process.stdout.write(`mpget skill → .claude/skills/mpget.md\n`)
}

export function setupInitCommand(program: Command, cwd?: string): void {
  program
    .command("init")
    .description("安装 mpget skill 到 .claude/skills/")
    .action(() => {
      const base = cwd ?? process.env.INIT_CWD ?? process.cwd()
      installSkill(base)
    })
}
