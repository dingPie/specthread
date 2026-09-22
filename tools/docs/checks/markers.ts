/**
 * 마커 ↔ 관리 문서 대조 (`docs/system/rules.md` §4-1).
 *
 * 양방향으로 본다 - 코드·문서에 박힌 새 형식 마커가 관리 문서 항목을 실제로
 * 가리키는가, 그리고 관리 문서 항목이 최소 하나의 마커에서라도 걸리는가.
 */
import { RULE } from "../constants/rules.ts";
import type { DocIndex, Finding, IndexedFile } from "../types.ts";

const ITEM = /^###\s+`\[([a-z]+::[a-z0-9][a-z0-9-]*)\]`/;

/** 관리 문서 항목 slug → 그 헤딩 줄 번호 */
const pendingItemLines = (pending: IndexedFile): Map<string, number> => {
  const out = new Map<string, number>();
  let inChangeLog = false;
  pending.lines.forEach((raw, i) => {
    if (/^## 변경 이력/.test(raw)) inChangeLog = true;
    if (inChangeLog) return;
    const m = ITEM.exec(raw);
    if (m) out.set(m[1], i + 1);
  });
  return out;
};

export const checkMarkers = (index: DocIndex): Finding[] => {
  const pending = index.files.get(index.config.pending);
  if (pending === undefined) return [];

  const items = pendingItemLines(pending);
  const findings: Finding[] = [];
  const seen = new Set<string>();

  for (const file of index.files.values()) {
    if (file.path === index.config.pending) continue;

    for (const marker of file.markers) {
      if (marker.slug === "") continue;

      const id = `${marker.kind}::${marker.slug}`;
      seen.add(id);

      if (items.has(id) || file.ignored.has(marker.line)) continue;

      findings.push({
        file: file.path,
        line: marker.line,
        rule: RULE.MARKER.ORPHAN,
        message: `PENDING::${id} 를 가리키는 관리 문서 항목이 없다`,
      });
    }
  }

  for (const [slug, line] of items) {
    if (seen.has(slug) || pending.ignored.has(line)) continue;

    findings.push({
      file: pending.path,
      line,
      rule: RULE.MARKER.UNMARKED,
      message: `[${slug}] 를 가리키는 마커가 없다 - 억제하려면 @specthread-ignore`,
    });
  }

  return findings;
};
