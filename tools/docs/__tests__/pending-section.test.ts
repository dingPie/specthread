import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import { parseMarkdown } from '../utils/parse.ts';
import { invertByTarget, pendingSectionBlock } from '../gen/pending-section.ts';
import type { DocIndex, IndexedFile } from '../types.ts';

const at = (path: string, ...lines: string[]): IndexedFile => ({
  ...parseMarkdown(path, lines),
  sectionRefs: [],
  ignored: new Set(),
});

const pendingFile = (...lines: string[]): IndexedFile => at('docs/pending.md', ...lines);

const mockIndex = (pending: IndexedFile): DocIndex => ({
  files: new Map([['docs/pending.md', pending]]),
  docsByName: new Map(),
  config: DEFAULT_CONFIG,
});

/** 미확정 사항 절 하나짜리 대상 문서 */
const targetDoc = (path: string): IndexedFile =>
  at(path, '# 제목', '## 미확정 사항', '자리표시자', '## 변경 이력', '| 날짜 | 내용 |');

test('참조가 가리키는 문서 기준으로 항목을 뒤집는다', () => {
  const pending = pendingFile(
    '# pending',
    '## 2. 도메인',
    '### `[deps::pierce-step]` pierce 적용 step',
    '',
    '작성일 2026-05-02',
    '',
    '참조: [`battle.md` §6](./spec/battle.md#6-데미지-공식)',
  );
  const byTarget = invertByTarget(pending);
  assert.deepEqual(byTarget.get('docs/spec/battle.md'), [
    { slug: 'deps::pierce-step', title: 'pierce 적용 step', anchor: 'depspierce-step-pierce-적용-step' },
  ]);
});

test('한 항목이 여러 문서를 가리키면 양쪽에 다 실린다', () => {
  const pending = pendingFile(
    '# pending',
    '## 2. 도메인',
    '### `[balance::token-limit]` 토큰 최대 보유량',
    '',
    '작성일 2026-08-16',
    '',
    '참조: [`dungeon.md`](./spec/dungeon.md), [`economy.md` §2](./spec/economy.md#2-토큰-시스템)',
  );
  const byTarget = invertByTarget(pending);
  assert.equal(byTarget.get('docs/spec/dungeon.md')?.length, 1);
  assert.equal(byTarget.get('docs/spec/economy.md')?.length, 1);
});

test('가리키는 항목이 없으면 해당 없음을 낸다', () => {
  const pending = pendingFile('# pending', '## 2. 도메인');
  const file = targetDoc('docs/spec/dungeon.md');
  const block = pendingSectionBlock(file, invertByTarget(pending), mockIndex(pending));
  assert.equal(block.some((l) => l.startsWith('해당 없음')), true);
});

test('미확정 사항 절이 없는 문서는 빈 배열이다 - 새로 만들지 않는다', () => {
  const pending = pendingFile(
    '# pending',
    '## 2. 도메인',
    '### `[deps::x]` 제목',
    '',
    '작성일 2026-08-16',
    '',
    '참조: [`STATUS.md`](./STATUS.md)',
  );
  const file = at('docs/STATUS.md', '# STATUS', '## 1. 개요', '내용');
  const block = pendingSectionBlock(file, invertByTarget(pending), mockIndex(pending));
  assert.deepEqual(block, []);
});

test('docs/work 문서는 절이 있어도 채우지 않는다', () => {
  const pending = pendingFile(
    '# pending',
    '## 2. 도메인',
    '### `[deps::x]` 제목',
    '',
    '작성일 2026-08-16',
    '',
    '참조: [`m2a-stage2.md`](./work/m2a-stage2.md)',
  );
  const file = targetDoc('docs/work/m2a-stage2.md');
  const block = pendingSectionBlock(file, invertByTarget(pending), mockIndex(pending));
  assert.deepEqual(block, []);
});
