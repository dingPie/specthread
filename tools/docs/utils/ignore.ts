/**
 * 인라인 억제 - `@specthread-ignore` 로 특정 줄의 지적을 막는다.
 *
 * 같은 줄이나 바로 윗줄에 `@specthread-ignore` 가 있으면 그 줄의 지적을 건너뛴다.
 * eslint-disable-next-line 과 같은 모델이다.
 *
 * 주석 안에 적은 것만 억제로 본다. 코드 스팬·펜스 안은 표기를 설명하는 글이다.
 */
import { codeSpanMask, eachContentLine } from "./parse.ts";
import type { DocIndex, FileKind, Finding } from "../types.ts";

/** 주석 여는 표기 뒤의 억제 토큰. `<!--`, `//`, `/*`, `#` */
const IGNORE = /(?:<!--|\/\/|\/\*|#)\s*@specthread-ignore\b/;

/** 줄 배열에서 억제된 줄 번호(1-indexed)를 모은다 */
export const parseIgnoredLines = (lines: string[], kind: FileKind = "source"): Set<number> => {
  const ignored = new Set<number>();

  const scan = (line: string, i: number) => {
    const m = IGNORE.exec(line);
    if (m === null) return;
    if (kind === "doc" && codeSpanMask(line)[m.index]) return;
    ignored.add(i + 1);
    if (i + 1 < lines.length) ignored.add(i + 2);
  };

  if (kind === "doc") eachContentLine(lines, scan);
  else lines.forEach((l, i) => scan(l, i));

  return ignored;
};

/** 인라인 억제에 해당하는 지적인지 */
export const isIgnored = (index: DocIndex, finding: Finding): boolean => {
  const file = index.files.get(finding.file);
  if (file === undefined) return false;
  return file.ignored.has(finding.line);
};
