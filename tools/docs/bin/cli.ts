#!/usr/bin/env node

const [command, ...rest] = process.argv.slice(2);

const usage = `specthread — Spec-Driven Development (SDD) 도구

사용법: specthread <command> [options]

commands:
  init [--tools claude,cursor]   프로젝트에 SDD 체계 초기화
  check                          문서 정합성 검사 (28개 규칙)
  gen [--write]                  참조 절·목차·미확정 사항 요약 생성
  help                           이 도움말 표시

examples:
  npx specthread init            새 프로젝트에 SDD 세팅
  npx specthread check           문서 규칙 위반 검사
  npx specthread gen             변경 대상 미리보기
  npx specthread gen --write     실제 적용

https://github.com/dingPie/specthread`;

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
    case "help":
    case "--help":
    case "-h":
      console.log(usage);
      break;
    default:
      console.log(usage);
      process.exit(command === undefined ? 0 : 1);
  }
};

run();
