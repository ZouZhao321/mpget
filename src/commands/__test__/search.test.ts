import { describe, it, expect, beforeEach } from "vitest"
import { Command } from "commander"
import { setupSearchCommand } from "../search.js"

describe("search command", () => {
  let program: Command
  beforeEach(() => {
    program = new Command()
    setupSearchCommand(program)
  })

  it("注册 search 子命令", () => {
    expect(program.commands.find((c) => c.name() === "search")).toBeDefined()
  })
  it("接受 -p 参数", () => {
    expect(
      program.commands.find((c) => c.name() === "search")?.options.find((o) => o.short === "-p"),
    ).toBeDefined()
  })
  it("接受 -a 和 -m 参数", () => {
    const cmd = program.commands.find((c) => c.name() === "search")!
    expect(cmd.options.find((o) => o.short === "-a")).toBeDefined()
    expect(cmd.options.find((o) => o.short === "-m")).toBeDefined()
  })
})
