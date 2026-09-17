/**
 * 검사 결과 출력. 파일별로 묶고 규칙별 집계를 붙인다.
 *
 * **터미널 꾸미기는 이 파일에만 둔다.** 다른 곳에서 ANSI 문자열을 만들면 제어 문자가
 * 소스 곳곳에 박혀 눈에 안 보이고, grep·sed 같은 도구가 그 파일을 못 다루게 된다.
 */
import type { Finding } from "../types.ts";

/** 터미널 강조. 규칙 이름을 흐리게 두어 메시지가 먼저 읽히게 한다 */
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RESET = "\x1b[0m";

/**
 * 지적을 파일별로 묶어 출력하고 규칙별 집계를 붙인다.
 *
 * 종료 코드를 돌려준다 - 지적이 있으면 1. 재편이 끝나면 이 값으로 종료 게이트에 넣는다.
 * 규칙별 집계가 있어야 어느 규칙이 소음을 내는지 보고 판단할 수 있다.
 */
export const report = (
  findings: Finding[],
  summary: { title: string; lines: string[] },
): number => {
  console.log(`${BOLD}${summary.title}${RESET}`);
  for (const line of summary.lines) console.log(`  ${line}`);

  if (findings.length === 0) {
    console.log(`\n${BOLD}지적 없음${RESET}`);
    return 0;
  }

  const byFile = new Map<string, Finding[]>();
  for (const f of findings) {
    const list = byFile.get(f.file) ?? [];
    list.push(f);
    byFile.set(f.file, list);
  }

  console.log(`\n${BOLD}지적 ${findings.length} 건${RESET}`);
  for (const [file, list] of [...byFile.entries()].sort()) {
    console.log(`\n  ${file}`);
    for (const f of list.sort((a, b) => a.line - b.line))
      console.log(
        `    ${String(f.line).padStart(5)}  ${DIM}${f.rule}${RESET}  ${f.message}`,
      );
  }

  const byRule = new Map<string, number>();
  for (const f of findings) byRule.set(f.rule, (byRule.get(f.rule) ?? 0) + 1);
  console.log(`\n${BOLD}규칙별${RESET}`);
  for (const [rule, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1]))
    console.log(`  ${String(n).padStart(5)}  ${rule}`);

  return 1;
};
