import { RULE } from '../constants/rules.ts';
/**
 * 참조 절 ↔ 본문 링크 일치.
 *
 * 목차와 같은 구조다 - 본문에 이미 있는 정보를 문서 하단에 한 번 더 적는 자리라
 * 손으로 관리하면 반드시 어긋난다. 생성 결과와 다르면 지적한다.
 */
import { isTargetDoc } from "../utils/scope.ts";
import { referenceBlock } from "../gen/references.ts";
import type { DocIndex, Finding } from "../types.ts";

/** 블록 안 항목 줄 수. 지적 메시지에 규모를 실어준다 */
const itemCount = (lines: string[]): number =>
  lines.filter((l) => l.startsWith("- [")).length;

export const checkReferences = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;

    // 본문 링크가 없으면 참조 절을 둘 이유가 없다
    const expected = referenceBlock(file, index.config);
    if (expected.length === 0) continue;

    if (file.refSection === null) {
      findings.push({
        file: file.path,
        line: file.lines.length,
        rule: RULE.REFERENCE.MISSING,
        message: `참조 절이 없다 - 본문 링크 ${itemCount(expected)} 대상`,
      });
      continue;
    }

    const actual = file.lines.slice(file.refSection.start - 1, file.refSection.end);

    if (actual.join("\n") !== expected.join("\n")) {
      findings.push({
        file: file.path,
        line: file.refSection.start,
        rule: RULE.REFERENCE.STALE,
        message: `참조 절이 본문 링크와 어긋난다 - 적힌 것 ${itemCount(actual)} / 본문 ${itemCount(expected)}`,
      });
    }
  }

  return findings;
};
