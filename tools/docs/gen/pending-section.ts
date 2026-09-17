/**
 * 미확정 사항 절 생성 - 관리 문서 항목의 백링크를 문서 기준으로 뒤집는다.
 *
 * 각 관리 문서 항목의 `참조:` 줄이 어느 문서를 가리키는지 이미 안다. 그것을 대상
 * 문서 기준으로 재정렬하면 그 문서의 미확정 목록이 나온다 (`docs/system/rules.md` §4).
 * 목차·참조 절과 같은 방식이다 - 정본은 관리 문서이고 여기는 생성 뷰다.
 *
 * **이미 절을 가진 문서만 채운다.** 참조는 _이 항목이 이 문서와 관련 있다_ 는
 * 인용이지 _이 문서가 이 미확정을 소유한다_ 는 선언이 아니다. `STATUS.md` 처럼
 * 배경으로 인용될 뿐인 문서에 절을 새로 만들면 소유하지 않는 것을 소유한 듯 보인다.
 *
 * **소비자가 둘이다.** `bin/generate.ts` 가 파일에 쓰고, `checks/pending.ts` 가 같은
 * 함수를 불러 지금 내용과 비교한다.
 */
import { dirname, join, normalize, relative } from 'node:path';
import type { DocIndex, IndexedFile } from '../types.ts';

const ITEM_HEADING = /^###\s+`\[([a-z]+::[a-z0-9][a-z0-9-]*)\]`\s*(.*)$/;
const REF_LINK = /\]\(([^)\s]+)\)/g;

type Item = { slug: string; title: string; anchor: string };

/** 관리 문서를 훑어 항목마다 (제목·앵커) 와 `참조:` 가 가리키는 대상 파일 집합을 뽑는다 */
const parseItems = (pending: IndexedFile): { item: Item; targets: Set<string> }[] => {
  const out: { item: Item; targets: Set<string> }[] = [];
  let current: (typeof out)[number] | null = null;
  let inChangeLog = false;

  pending.lines.forEach((raw, i) => {
    if (/^## 변경 이력/.test(raw)) inChangeLog = true;
    if (inChangeLog) return;

    const h = ITEM_HEADING.exec(raw);
    if (h !== null) {
      const heading = pending.headings.find((x) => x.line === i + 1);
      current = {
        item: { slug: h[1], title: h[2].trim(), anchor: heading?.anchor ?? '' },
        targets: new Set(),
      };
      out.push(current);
      return;
    }

    if (current === null || !raw.startsWith('참조:')) return;
    for (const m of raw.matchAll(REF_LINK)) {
      const path = m[1].split('#')[0];
      current.targets.add(normalize(join(dirname(pending.path), path)));
    }
  });

  return out;
};

/** 대상 문서 경로 → 그 문서를 가리키는 항목 목록 (slug 순) */
export const invertByTarget = (pending: IndexedFile): Map<string, Item[]> => {
  const byTarget = new Map<string, Item[]>();
  for (const { item, targets } of parseItems(pending)) {
    for (const target of targets) {
      const list = byTarget.get(target) ?? [];
      list.push(item);
      byTarget.set(target, list);
    }
  }
  for (const list of byTarget.values()) list.sort((a, b) => a.slug.localeCompare(b.slug));
  return byTarget;
};

/**
 * 미확정 사항 절 본문. 절 자체가 없는 문서는 빈 배열 - 새로 만들지 않는다.
 *
 * 절은 있는데 가리키는 항목이 0 인 경우도 있다 (전부 해소됐거나 애초에 없음). 그때도
 * _해당 없음_ 을 명시해 빈 채로 방치하지 않는다 - 빈 결과와 stale 결과를 구분 못 하면
 * 검사가 항상 통과해 버린다.
 */
export const pendingSectionBlock = (file: IndexedFile, byTarget: Map<string, Item[]>, index: DocIndex): string[] => {
  if (file.pendingSection === null) return [];
  if (file.path.startsWith(index.config.work)) return [];

  const items = byTarget.get(file.path) ?? [];
  const rel = relative(dirname(file.path), index.config.pending);
  const link = rel.startsWith('.') ? rel : `./${rel}`;

  if (items.length === 0) {
    return ['', `해당 없음 - 이 문서를 가리키는 미확정 항목이 없다 ([\`pending.md\`](${link})).`, ''];
  }

  return [
    '',
    `> **정본은 [\`pending.md\`](${link}) 다.** 이 절은 그 항목을 이 문서 기준으로 되짚은 생성 뷰다.`,
    '',
    ...items.map((it) => `- [\`${it.slug}\`](${link}#${it.anchor}) ${it.title}`),
    '',
  ];
};

/** 미확정 사항 절을 채운 문서 줄 목록. 바꿀 것이 없으면 null */
export const applyPendingSection = (
  file: IndexedFile,
  lines: string[],
  index: DocIndex,
): string[] | null => {
  if (file.path === index.config.pending) return null;

  const pending = index.files.get(index.config.pending);
  if (pending === undefined) return null;

  const block = pendingSectionBlock(file, invertByTarget(pending), index);
  if (block.length === 0 || file.pendingSection === null) return null;

  const { start, end } = file.pendingSection;
  const current = lines.slice(start - 1, end);
  if (current.join('\n') === block.join('\n')) return null;

  return [...lines.slice(0, start - 1), ...block, ...lines.slice(end)];
};
