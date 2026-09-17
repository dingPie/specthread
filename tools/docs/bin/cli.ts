#!/usr/bin/env node

const [command, ...rest] = process.argv.slice(2);

const usage = `specthread <command>

commands:
  init [--tools claude,cursor]   프로젝트 초기화
  check                          문서 검사
  gen [--write]                  참조/목차 생성`;

const run = async () => {
  switch (command) {
    case "check":
      await import("./check.ts");
      break;
    case "gen":
      await import("./generate.ts");
      break;
    case "init":
      await (await import("../commands/init.ts")).init(rest);
      break;
    default:
      console.log(usage);
      process.exit(command === undefined || command === "--help" ? 0 : 1);
  }
};

run();
