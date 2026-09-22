/**
 * 관리 문서 절 머리 요약 표 생성 - 항목 헤딩을 모아 절 첫머리를 채운다.
 *
 * 항목이 100 개를 넘으면 문서를 위에서 아래로 읽어 파악하는 것이 불가능하다. 그런데
 * 목차 블록은 헤딩 문자열만 담을 수 있어서 (`gen/toc.ts`) 제목을 두 번 읽게 만드는 것
 * 말고는 하는 일이 없다. 표는 열을 갖는다 - 처리 시점이 빈 항목과 어디에도 안 걸린
 * 항목이 훑는 것만으로 드러난다.
 *
 * 셋 다 손으로 셀 수 없는 값이라 표가 정본을 갖지 않는다. `걸린 곳` 은 리포 전체의
 * 마커를 세야 나오고, 나머지 둘은 항목 본문이 갖는다.
 *
 * **소비자가 둘이다.** `bin/generate.ts` 가 파일에 쓰고, `checks/pending.ts` 가 같은
 * 함수를 불러 지금 내용과 비교한다.
 */
import { TIMEPOINT } from '../constants/patterns.ts';
import { slugify } from '../utils/anchor.ts';
import type { DocIndex, IndexedFile } from '../types.ts';

/** 관리 문서인지. 표는 그 한 파일에만 붙는다 */
export const isPendingDoc = (file: IndexedFile, index: DocIndex): boolean =>
  file.path === index.config.pending;

/** 항목 헤딩. id 와 제목을 함께 캡처한다 */
const ITEM_HEADING = /^###\s+`\[([a-z]+::[a-z0-9][a-z0-9-]*)\]`\s*(.*)$/;

/** 항목 첫 본문 줄의 시점 표기 */
const TIMEPOINT_LINE = new RegExp(`^${TIMEPOINT.source}$`);

/** 표 한 행이 되는 항목 하나 */
export interface SummaryRow {
  slug: string;
  title: string;
  anchor: string;
  /** 해결 예정 라벨. 정하지 않았으면 null */
  timepoint: string | null;
  /** 마커가 걸린 곳 수 */
  sites: number;
}

/**
 * 절 하나의 범위. 절 헤딩 다음 줄부터 첫 항목 헤딩 앞까지가 표 자리다.
 *
 * 항목이 없는 절은 다음 `##` 앞까지다 - 표를 넣을 자리는 있지만 넣을 것이 없다.
 */
type SectionRange = { heading: number; blockStart: number; blockEnd: number; items: number[] };

const sections = (lines: string[]): SectionRange[] => {
  const out: SectionRange[] = [];
  let cur: SectionRange | null = null;
  lines.forEach((line, i) => {
    if (/^##\s+\d/.test(line)) {
      cur = { heading: i + 1, blockStart: i + 2, blockEnd: i + 1, items: [] };
      out.push(cur);
      return;
    }
    if (/^##\s/.test(line)) {
      cur = null;
      return;
    }
    if (cur === null) return;
    if (ITEM_HEADING.test(line)) {
      cur.items.push(i + 1);
      return;
    }
    // 첫 항목 앞까지만 표 자리다. 항목이 나온 뒤의 줄은 본문이다
    if (cur.items.length === 0) cur.blockEnd = i + 1;
  });
  return out.filter((s) => s.items.length > 0);
};

/** slug 별 마커 위치 수. 초안 문서는 세지 않는다 - 흡수되면 사라진다 */
const markerSites = (index: DocIndex): Map<string, number> => {
  const out = new Map<string, number>();
  for (const file of index.files.values()) {
    if (file.path.startsWith(index.config.work)) continue;
    for (const marker of file.markers) {
      if (marker.slug === '') continue;
      const id = `${marker.kind}::${marker.slug}`;
      out.set(id, (out.get(id) ?? 0) + 1);
    }
  }
  return out;
};

/** 절 안 항목을 표 행으로. 시점은 항목 첫 본문 줄에서 읽는다 */
const rows = (lines: string[], itemLines: number[], sites: Map<string, number>): SummaryRow[] =>
  itemLines.map((at) => {
    const m = ITEM_HEADING.exec(lines[at - 1]);
    if (m === null) throw new Error(`항목 헤딩이 아니다 - ${at}`);

    // 헤딩 다음 첫 내용 줄이 시점이다. 없으면 검사기가 따로 지적한다
    let timepoint: string | null = null;
    for (let i = at; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '') continue;
      const stamp = TIMEPOINT_LINE.exec(line);
      timepoint = stamp?.[2]?.trim() ?? null;
      break;
    }

    const slug = m[1];
    return {
      slug,
      title: m[2].trim(),
      anchor: slugify(lines[at - 1].replace(/^###\s+/, '')),
      timepoint,
      sites: sites.get(slug) ?? 0,
    };
  });

/** 표 블록. 절 헤딩과 첫 항목 사이에 놓일 모양 그대로 (앞뒤 빈 줄 포함) */
export const summaryTable = (list: SummaryRow[]): string[] => [
  '',
  '| id | 항목 | 해결 예정 | 걸린 곳 |',
  '|----|-----|--------|-------|',
  ...list.map(
    (r) => `| [\`${r.slug}\`](#${r.anchor}) | ${r.title} | ${r.timepoint ?? ''} | ${r.sites === 0 ? '' : r.sites} |`,
  ),
  '',
];

/** 절마다 기대되는 표 블록. 항목이 있는 절만 나온다 */
export const summaryBlocks = (
  lines: string[],
  index: DocIndex,
): { blockStart: number; blockEnd: number; block: string[] }[] => {
  const sites = markerSites(index);
  return sections(lines).map((s) => ({
    blockStart: s.blockStart,
    blockEnd: s.blockEnd,
    block: summaryTable(rows(lines, s.items, sites)),
  }));
};

/**
 * 요약 표를 채운 줄 목록. 바꿀 것이 없으면 null.
 *
 * 절이 여럿이라 **아래 절부터** 갈아끼운다. 위를 먼저 고치면 아래 절의 줄 번호가 밀린다.
 */
export const applySummary = (
  file: IndexedFile,
  lines: string[],
  index: DocIndex,
): string[] | null => {
  if (!isPendingDoc(file, index)) return null;

  const blocks = summaryBlocks(lines, index);
  if (blocks.length === 0) return null;

  let next = lines;
  let changed = false;
  for (const { blockStart, blockEnd, block } of [...blocks].reverse()) {
    const current = next.slice(blockStart - 1, blockEnd);
    if (current.join('\n') === block.join('\n')) continue;
    next = [...next.slice(0, blockStart - 1), ...block, ...next.slice(blockEnd)];
    changed = true;
  }
  return changed ? next : null;
};
