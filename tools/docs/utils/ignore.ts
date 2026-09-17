/**
 * 인라인 억제 - `@specthread-ignore` 로 특정 줄의 지적을 막는다.
 *
 * 같은 줄이나 바로 윗줄에 `@specthread-ignore` 가 있으면 그 줄의 지적을 건너뛴다.
 * eslint-disable-next-line 과 같은 모델이다.
 */
import type { DocIndex, Finding } from "../types.ts";

const IGNORE = /@specthread-ignore/;

/** 줄 배열에서 억제된 줄 번호(1-indexed)를 모은다 */
export const parseIgnoredLines = (lines: string[]): Set<number> => {
  const ignored = new Set<number>();

  for (let i = 0; i < lines.length; i++) {
    if (!IGNORE.test(lines[i])) continue;
    ignored.add(i + 1);
    if (i + 1 < lines.length) ignored.add(i + 2);
  }

  return ignored;
};

/** 인라인 억제에 해당하는 지적인지 */
export const isIgnored = (index: DocIndex, finding: Finding): boolean => {
  const file = index.files.get(finding.file);
  if (file === undefined) return false;
  return file.ignored.has(finding.line);
};
