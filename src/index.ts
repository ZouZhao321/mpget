#!/usr/bin/env node
import { Command } from 'commander';
import { VERSION, CLI_NAME } from './version.js';
import { setupSearchCommand } from './commands/search.js';
import { setupContentCommand } from './commands/content.js';
import { setupInitCommand } from './commands/init.js';

const program = new Command();
program.name(CLI_NAME).version(VERSION).description('微信公众号内容搜索与获取终端工具');
setupSearchCommand(program);
setupContentCommand(program);
setupInitCommand(program);
program.parse(process.argv);
