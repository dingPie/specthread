import { RULE } from '../constants/rules.ts';
/** 변경 이력 순서 - 오래된 순이어야 한다 (`docs/system/rules.md` §2-4). */
import { isTargetDoc } from '../utils/scope.ts';
import type { DocIndex, Finding } from '../types.ts';

/**
 * 날짜가 거꾸로 놓인 첫 자리를 찾아 한 건만 지적한다.
 *
 * 줄마다 지적하면 한 문서에서 여러 건이 쏟아지는데 고치는 일은 표 하나를 다시
 * 정렬하는 한 번의 작업이다.
 */
export const checkChangeLog = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;
    if (file.changeLogDates.length < 2) continue;
    const dates = file.changeLogDates;
    const bad = dates.findIndex((d, i) => i > 0 && d < dates[i - 1]);
    if (bad < 0) continue;

    const heading = file.headings.find((h) => h.title === '변경 이력');
    findings.push({
      file: file.path,
      line: heading?.line ?? 1,
      rule: RULE.CHANGELOG.ORDER,
      message: `오래된 순이 아니다 - ${dates[bad - 1]} 다음에 ${dates[bad]}`,
    });
  }

  return findings;
};
