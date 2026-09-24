/**
 * 문서 검사기 진입점. `pnpm docs:check`
 *
 * `pnpm test` 와 분리해 둔다 - 실 문서 재편이 끝나기 전에는 목차·참조 절 지적이
 * 대량으로 남으므로, 4 smoke 에 넣으면 게이트가 상시 red 가 되어 신호 기능을 잃는다.
 */
import { loadConfig } from '../config-loader.ts';
import { buildIndex } from '../utils/scan.ts';
import { checkLinks } from '../checks/links.ts';
import { checkSectionRefs } from '../checks/sections.ts';
import { checkChangeLog } from '../checks/changelog.ts';
import { checkHeadings } from '../checks/headings.ts';
import { checkToc } from '../checks/toc.ts';
import { checkReferences } from '../checks/references.ts';
import { checkTimestamps } from '../checks/timestamps.ts';
import { checkPending } from '../checks/pending.ts';
import { checkMarkers } from '../checks/markers.ts';
import { checkRuleDeclared, checkStyle } from '../checks/style.ts';
import { isIgnored } from '../utils/ignore.ts';
import { report } from '../utils/report.ts';
import { isSkipCheckExempt } from '../utils/scope.ts';

const config = loadConfig();
const index = buildIndex(config);

// 색인 규모를 먼저 찍는다. 지적 수만 보면 검사가 실제로 대상을 훑었는지 알 수 없다
const counts = { doc: 0, source: 0 };
let headings = 0;
let links = 0;
let sectionRefs = 0;
let markers = 0;
let pendingItems = 0;
for (const f of index.files.values()) {
  counts[f.kind]++;
  headings += f.headings.length;
  links += f.links.length;
  sectionRefs += f.sectionRefs.length;
  markers += f.markers.length;
  pendingItems += f.pendingItems.length;
}

let ignoredLines = 0;
for (const f of index.files.values()) ignoredLines += f.ignored.size;

const summary = {
  title: '색인',
  lines: [
    `문서 ${counts.doc} / 소스 ${counts.source}`,
    `헤딩 ${headings} / 링크 ${links} / 절 참조 ${sectionRefs}`,
    `마커 ${markers} / 미확정 항목 ${pendingItems}`,
    `인라인 억제 ${ignoredLines}`,
  ],
};

const { features } = config;
const findings = [
  ...checkHeadings(index),
  ...checkToc(index),
  ...(features.references ? checkReferences(index) : []),
  ...checkLinks(index),
  ...checkSectionRefs(index),
  ...checkChangeLog(index),
  ...checkTimestamps(index),
  ...(features.markers ? checkPending(index) : []),
  ...(features.markers ? checkMarkers(index) : []),
  ...(features.emDash ? checkStyle(index) : []),
  ...checkRuleDeclared(index),
].filter((f) => !isSkipCheckExempt(f, index.config) && !isIgnored(index, f));

process.exit(report(findings, summary));
