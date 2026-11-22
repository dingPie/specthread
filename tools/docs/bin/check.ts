/**
 * 문서 검사기 진입점. `specthread check`
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { PathConfig } from '../config.schema.ts';
import { runCheck } from '../run-check.ts';
import { normalizeConfigPath, underPath } from '../utils/path-match.ts';
import { buildIndex } from '../utils/scan.ts';
import { report } from '../utils/report.ts';
import { openProject } from './open-project.ts';

/**
 * `config.path` 의 경로마다 색인한 파일 수. 없는 경로는 `없음` 으로 낸다.
 *
 * 규약 파일은 `path` 와 관계없이 색인되므로 전체 문서 수로는 `path` 가 틀린 것을 알 수 없다.
 * 새 프로젝트에는 `docs/` 가 아직 없을 수 있어서 실패로 처리하지 않고 표시만 한다.
 */
const pathCounts = (root: string, path: PathConfig, files: string[]): string => {
  const entries = [...new Set(Object.values(path).flat())];
  const parts = entries.map((entry) => {
    if (!existsSync(join(root, entry))) return `${entry} 없음`;
    const base = normalizeConfigPath(entry);
    return `${entry} 파일 ${files.filter((f) => underPath(f, base)).length}`;
  });
  return `검사 경로 ${parts.join(' / ')}`;
};

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

const summary = {
  title: '색인',
  lines: [
    `문서 ${counts.doc} / 소스 ${counts.source}`,
    pathCounts(root, config.path, [...index.files.keys()]),
    `헤딩 ${headings} / 링크 ${links} / 절 참조 ${sectionRefs}`,
    `마커 ${markers} / 보류 항목 ${pendingItems}`,
    `인라인 억제 ${ignoredLines}`,
  ],
};

process.exit(report(runCheck(index), summary));
