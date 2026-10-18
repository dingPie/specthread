/**
 * 검사 실행 - 색인에 활성 검사를 모두 걸고 범위 밖 지적을 거른다.
 *
 * 진입점 (`bin/check.ts`) 과 테스트가 같은 경로로 검사를 돌리도록 분리해 둔다.
 */
import { checkChangeLog } from './checks/changelog.ts';
import { checkHeadings } from './checks/headings.ts';
import { checkLinks } from './checks/links.ts';
import { checkMarkers } from './checks/markers.ts';
import { checkPending } from './checks/pending.ts';
import { checkReferences } from './checks/references.ts';
import { checkSectionRefs } from './checks/sections.ts';
import { checkRuleDeclared } from './checks/style.ts';
import { checkTimestamps } from './checks/timestamps.ts';
import { checkToc } from './checks/toc.ts';
import { isIgnored } from './utils/ignore.ts';
import { isSkipped } from './utils/scope.ts';
import type { DocIndex, Finding } from './types.ts';

/** 활성 검사의 지적 전부. 범위 판정 전이다 */
export const collectFindings = (index: DocIndex): Finding[] => {
  const { features } = index.config;
  return [
    ...checkHeadings(index),
    ...checkToc(index),
    ...(features.references ? checkReferences(index) : []),
    ...checkLinks(index),
    ...checkSectionRefs(index),
    ...checkChangeLog(index),
    ...checkTimestamps(index),
    ...(features.markers ? checkPending(index) : []),
    ...(features.markers ? checkMarkers(index) : []),
    ...checkRuleDeclared(index),
  ];
};

/** skipCheck·기본 제외·인라인 억제를 거친 지적 */
export const runCheck = (index: DocIndex): Finding[] =>
  collectFindings(index).filter((f) => !isSkipped(f, index.config) && !isIgnored(index, f));
