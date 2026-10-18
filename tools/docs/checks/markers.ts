/**
 * 마커 ↔ 관리 문서 대조 (`specthread/rules.md` §4-1).
 *
 * 양방향으로 본다 - 코드·문서에 박힌 새 형식 마커가 관리 문서 항목을 실제로
 * 가리키는가, 그리고 관리 문서 항목이 최소 하나의 마커에서라도 걸리는가.
 * 종류가 `markers.types` 에 있는지도 함께 본다.
 */
import { PENDING_PATH } from "../constants/paths.ts";
import { ITEM_HEADING } from "../constants/patterns.ts";
import { RULE } from "../constants/rules.ts";
import { eachContentLine } from "../utils/parse.ts";
import { inChangeLog } from "../utils/scope.ts";
import type { DocIndex, Finding, IndexedFile } from "../types.ts";

/** 관리 문서 항목 id → 그 헤딩 줄 번호. 변경 이력 안의 것은 과거 기록이라 뺀다 */
export const pendingItemLines = (pending: IndexedFile): Map<string, number> => {
  const out = new Map<string, number>();

  const collect = (raw: string, i: number) => {
    const line = i + 1;
    if (inChangeLog(pending, line)) return;
    const m = ITEM_HEADING.exec(raw);
    if (m) out.set(m[1], line);
  };

  eachContentLine(pending.lines, collect);
  return out;
};

const kindOf = (id: string): string => id.split("::")[0];

export const checkMarkers = (index: DocIndex): Finding[] => {
  const pending = index.files.get(PENDING_PATH);
  if (pending === undefined) return [];

  const items = pendingItemLines(pending);
  const types = new Set(index.config.markers.types);
  const findings: Finding[] = [];
  const seen = new Set<string>();

  const unknownType = (file: string, line: number, id: string): Finding => ({
    file,
    line,
    rule: RULE.MARKER.UNKNOWN_TYPE,
    message: `종류 ${kindOf(id)} 가 config.markers.types 에 없다 - ${id}`,
  });

  for (const file of index.files.values()) {
    if (file.path === PENDING_PATH) continue;

    for (const marker of file.markers) {
      if (marker.slug === "") continue;

      const id = `${marker.kind}::${marker.slug}`;
      seen.add(id);

      if (!types.has(marker.kind)) findings.push(unknownType(file.path, marker.line, id));
      if (items.has(id)) continue;

      findings.push({
        file: file.path,
        line: marker.line,
        rule: RULE.MARKER.ORPHAN,
        message: `PENDING::${id} 를 가리키는 관리 문서 항목이 없다`,
      });
    }
  }

  for (const [id, line] of items) {
    if (!types.has(kindOf(id))) findings.push(unknownType(pending.path, line, id));
    if (seen.has(id)) continue;

    findings.push({
      file: pending.path,
      line,
      rule: RULE.MARKER.UNMARKED,
      message: `[${id}] 를 가리키는 마커가 없다 - 억제하려면 @specthread-ignore`,
    });
  }

  return findings;
};
