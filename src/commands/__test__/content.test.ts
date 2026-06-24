import { describe, it, expect, beforeEach } from "vitest"
import { Command } from "commander"
import { setupContentCommand } from "../content.js"

describe("content command", () => {
  let program: Command
  beforeEach(() => {
    program = new Command()
    setupContentCommand(program)
  })

  it("注册 content 子命令", () => {
    expect(program.commands.find((c) => c.name() === "content")).toBeDefined()
  })
  it("接受 -r 参数", () => {
    expect(
      program.commands.find((c) => c.name() === "content")?.options.find((o) => o.short === "-r"),
    ).toBeDefined()
  })
  it("描述不为空", () => {
    const cmd = program.commands.find((c) => c.name() === "content")!
    expect(cmd.description()).toBeTruthy()
  })
})
