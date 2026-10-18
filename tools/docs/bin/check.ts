/**
 * 문서 검사기 진입점. `specthread check`
 */
import { runCheck } from '../run-check.ts';
import { buildIndex } from '../utils/scan.ts';
import { report } from '../utils/report.ts';
import { openProject } from './open-project.ts';

const { root, config } = openProject();
const index = buildIndex(root, config);

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

if (counts.doc === 0) {
  console.warn('[specthread] 색인한 문서가 0 건이다. config.path 를 확인한다');
}

const summary = {
  title: '색인',
  lines: [
    `문서 ${counts.doc} / 소스 ${counts.source}`,
    `헤딩 ${headings} / 링크 ${links} / 절 참조 ${sectionRefs}`,
    `마커 ${markers} / 미확정 항목 ${pendingItems}`,
    `인라인 억제 ${ignoredLines}`,
  ],
};

process.exit(report(runCheck(index), summary));
