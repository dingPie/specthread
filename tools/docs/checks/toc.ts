import { RULE } from '../constants/rules.ts';
/**
 * 목차 ↔ `##` 헤딩 일치.
 *
 * 목차는 생성기가 채우지만 사람이 손으로 고칠 수 있고, 절을 하나 끼워 넣으면
 * 조용히 어긋난다. 생성 결과와 다르면 지적한다 - 고치는 방법은 `pnpm docs:generate --write` 다.
 */
import { isTargetDoc, singleTitle } from "../utils/scope.ts";
import { tocBlock } from "../gen/toc.ts";
import type { DocIndex, Finding } from "../types.ts";

export const checkToc = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;
    if (singleTitle(file) === null) continue;

    // `##` 절이 없으면 목차를 둘 이유가 없다
    const expected = tocBlock(file.headings);

    if (expected.length === 0) continue;

    if (file.tocBlock === null) {
      findings.push({
        file: file.path,
        line: 1,
        rule: RULE.TOC.MISSING,
        message: "제목 아래 목차가 없다",
      });
      continue;
    }

    const actual = file.lines.slice(file.tocBlock.start - 1, file.tocBlock.end);

    if (actual.join("\n") !== expected.join("\n")) {
      findings.push({
        file: file.path,
        line: file.tocBlock.start,
        rule: RULE.TOC.STALE,
        message: `목차가 헤딩과 어긋난다 - 항목 ${actual.length - 2} / 헤딩 ${expected.length - 2}`,
      });
    }
  }

  return findings;
};
