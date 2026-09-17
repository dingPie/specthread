import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMarkdown } from '../utils/parse.ts';
import { makeRefContext, parseSectionRefs } from '../utils/resolve.ts';

const DOCS = [
  'docs/spec/battle.md',
  'docs/spec/effects.md',
  'docs/spec/player.md',
  'docs/spec/data-conventions.md',
  'docs/template/spec.md',
  'CLAUDE.md',
  'client/CLAUDE.md',
];
const ctx = makeRefContext(DOCS, ['spec']);

const refs = (from: string, ...lines: string[]) =>
  parseSectionRefs(from, from.endsWith('.md') ? 'md' : 'code', lines, ctx);

test('펜스 코드블록 안 헤딩·링크를 세지 않는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 1. 실제',
    '```markdown',
    '## 2. 골격 예시',
    '[가짜](./nowhere.md)',
    '```',
    '## 3. 실제',
  ]);
  assert.deepEqual(
    parsed.headings.filter((h) => h.level === 2).map((h) => h.num),
    ['1', '3'],
  );
  // 문서 제목도 헤딩 목록에 담긴다 - 제목이 둘인 문서를 가려내야 한다
  assert.deepEqual(
    parsed.headings.filter((h) => h.level === 1).map((h) => h.title),
    ['제목'],
  );
  assert.equal(parsed.links.length, 0);
});

test('절 참조 - 파일명만 적힌 형태', () => {
  const [r] = refs('client/src/a.ts', 'battle.md §7 참조');
  assert.equal(r.targetFile, 'docs/spec/battle.md');
  assert.equal(r.num, '7');
});

test('절 참조 - 경로 접두가 붙은 형태', () => {
  const [r] = refs('client/src/a.ts', '// spec/player.md §2-2 정합');
  assert.equal(r.targetFile, 'docs/spec/player.md');
});

test('절 참조 - 확장자 없는 문서명', () => {
  const [r] = refs('client/src/a.ts', '// cmp 표준 (data-conventions §2)');
  assert.equal(r.targetFile, 'docs/spec/data-conventions.md');
});

test('절 참조 - 복수 절이 같은 문서에 붙는다', () => {
  const out = refs('client/src/a.ts', '// battle.md §1·§4·§6');
  assert.deepEqual(
    out.map((r) => r.num),
    ['1', '4', '6'],
  );
  assert.ok(out.every((r) => r.targetFile === 'docs/spec/battle.md'));
});

test('절 참조 - 한 줄에 두 문서면 각자 가까운 쪽에 붙는다', () => {
  const out = refs('client/src/a.ts', '// battle.md §1 과 effects.md §3');
  assert.equal(out[0].targetFile, 'docs/spec/battle.md');
  assert.equal(out[1].targetFile, 'docs/spec/effects.md');
});

test('절 참조 - 상대 경로는 참조한 문서 기준으로 푼다', () => {
  // `../../CLAUDE.md` 를 그냥 벗기면 루트와 client 중 어느 쪽인지 잃는다
  const [r] = refs('docs/work/a.md', '[`CLAUDE.md`](../../CLAUDE.md) §1.6 정합');
  assert.equal(r.targetFile, 'CLAUDE.md');
  assert.equal(r.reason, 'resolved');
});

test('절 참조 - 마크다운 링크가 있으면 그 경로가 stem 을 이긴다', () => {
  const [r] = refs('docs/work/a.md', '[`CLAUDE.md`](../../client/CLAUDE.md) §5');
  assert.equal(r.targetFile, 'client/CLAUDE.md');
});

test('절 참조 - `spec` 은 문서명으로 쓰지 않는다', () => {
  const [r] = refs('client/src/a.ts', '// 자기 턴 종료 시점이 정본 (spec §2-2');
  assert.equal(r.reason, 'no-doc-name');
  assert.equal(r.targetFile, null);
});

test('절 참조 - 문서명이 없으면 코드는 미해소, 문서는 자기 참조', () => {
  assert.equal(refs('client/src/a.ts', '// §10 snapshot')[0].reason, 'no-doc-name');
  const [r] = refs('docs/spec/battle.md', '| 이니셔티브 판정 | §4-1 |');
  assert.equal(r.targetFile, 'docs/spec/battle.md');
});

test('절 참조 - 문서명과 § 사이에 한글이 끼면 그 문서명이 아니다', () => {
  const [r] = refs('docs/work/a.md', '`notebook.md` 는 제외한다 (§5 가정 1)');
  assert.equal(r.rawTarget, null);
});

test('절 참조 - 백틱 안 문서명 없는 `§N` 은 표기법 인용이라 세지 않는다', () => {
  assert.equal(refs('docs/work/a.md', '완전 숫자 체계 사용 (예: `§1-A-3`, `§1-B-1`)').length, 0);
  // 문서명을 함께 담은 백틱은 실 참조다
  const [r] = refs('docs/work/a.md', '정본은 `battle.md §7` 이다');
  assert.equal(r.targetFile, 'docs/spec/battle.md');
});

test('절 참조 - 앵커 링크 라벨 안에 있으면 linked', () => {
  const [r] = refs('docs/work/a.md', '정본은 [`battle.md` §7](../spec/battle.md#7-승리---패배-조건) 이다');
  assert.equal(r.linked, true);
  assert.equal(r.targetFile, 'docs/spec/battle.md');
});

test('절 참조 - 링크 밖 § 는 linked 가 아니다', () => {
  // 파일만 링크로 걸고 § 를 옆에 적은 형태. 앵커로 옮겨야 한다
  const [r] = refs('docs/work/a.md', '[`battle.md`](../spec/battle.md) §7 참조');
  assert.equal(r.linked, false);
  assert.equal(r.targetFile, 'docs/spec/battle.md');
});

test('절 참조 - 앵커 없는 링크의 라벨 안 § 도 linked 가 아니다', () => {
  const [r] = refs('docs/work/a.md', '[`battle.md` §7](../spec/battle.md)');
  assert.equal(r.linked, false);
});

test('링크 - 절 귀속과 꼬리 절 표시', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 1. 본문',
    '[a](./a.md)',
    '## 참조',
    '[b](./b.md)',
  ]);
  assert.equal(parsed.links[0].section, '1');
  assert.equal(parsed.links[0].inTail, false);
  assert.equal(parsed.links[1].inTail, true);
});

test('목차 블록 위치를 잡는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '',
    '**목차**',
    '',
    '- [1 개요](#1-개요)',
    '- [참조](#참조)',
    '',
    '## 1. 개요',
  ]);
  assert.deepEqual(parsed.tocBlock, { start: 3, end: 6 });
});

test('한 줄에 몰아 쓴 인라인 목차도 블록으로 잡는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '',
    '**목차** - [1 개요](#1-개요) · [참조](#참조)',
    '',
    '## 1. 개요',
  ]);
  assert.deepEqual(parsed.tocBlock, { start: 3, end: 3 });
});

test('목차가 없으면 null', () => {
  assert.equal(parseMarkdown('docs/x.md', ['# 제목', '', '## 1. 개요']).tocBlock, null);
});

test('변경 이력 범위와 날짜를 모은다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 1. 본문',
    '| 2020-01-01 | 본문 표는 세지 않는다 |',
    '## 변경 이력',
    '| 날짜 | 내용 |',
    '| 2026-08-09 | 최초 |',
    '| 2026-08-11 | 수정 |',
  ]);
  assert.deepEqual(parsed.changeLogDates, ['2026-08-09', '2026-08-11']);
  // 헤딩 줄은 범위에 넣지 않는다 - 생성기가 절 제목을 지우면 안 된다
  assert.deepEqual(parsed.changeLogRange, { start: 5, end: 7 });
});

test('본문 절 이름이 꼬리 이름과 겹쳐도 범위가 뒤집히지 않는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 3. 참조 방식',
    '본문',
    '## 4. 다음',
    '본문',
    '## 참조',
    '- [a](./a.md)',
  ]);
  assert.deepEqual(parsed.refSection, { start: 7, end: 7 });
});

test('미확정 항목을 종류와 slug 로 읽는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 미확정 사항',
    '- `[system::rules-autoload]` 설명',
    '- `[balance::token-limit]` 시점 표기까지 [2026-05-02 → M2-B]',
  ]);
  assert.deepEqual(parsed.pendingItems, [
    { kind: 'system', slug: 'rules-autoload', line: 3 },
    { kind: 'balance', slug: 'token-limit', line: 4 },
  ]);
});

test('구 형식 체크박스 항목은 읽지 않는다', () => {
  // 체크박스는 폐기됐다. 해결되면 지우므로 `[x]` 상태가 존재하지 않는다
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '## 미확정 사항',
    '- [ ] **[system::rules-autoload]** 설명',
  ]);
  assert.deepEqual(parsed.pendingItems, []);
});

test('마커를 새 형식과 구 형식으로 갈라 읽는다', () => {
  const parsed = parseMarkdown('docs/x.md', [
    '# 제목',
    '`PENDING::deps::pierce-step` 미결',
    'TEMP_BALANCE (M2) 잠정 수치',
  ]);
  assert.deepEqual(parsed.markers, [
    { kind: 'deps', slug: 'pierce-step', line: 2, legacy: false },
    { kind: 'balance', slug: '', line: 3, legacy: true },
  ]);
});
