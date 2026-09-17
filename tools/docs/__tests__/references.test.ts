import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import { parseMarkdown } from '../utils/parse.ts';
import { applyReferences, referenceBlock } from '../gen/references.ts';
import type { DocIndex, IndexedFile } from '../types.ts';

const cfg = DEFAULT_CONFIG;

/** 절 참조 해소는 참조 절 생성과 무관하므로 빈 채로 채운다 */
const at = (path: string, ...lines: string[]): IndexedFile => ({
  ...parseMarkdown(path, lines),
  sectionRefs: [],
  ignored: new Set(),
});

const indexed = (...lines: string[]): IndexedFile => at('docs/x.md', ...lines);

const toIndex = (file: IndexedFile): DocIndex => ({
  files: new Map([[file.path, file]]),
  docsByName: new Map(),
  config: cfg,
});

/** 생성 블록에서 항목 줄만 */
const items = (file: IndexedFile) =>
  referenceBlock(file, cfg).filter((l) => l.startsWith('- ['));

test('같은 대상을 한 줄로 합치고 가리킨 절을 나열한다', () => {
  const file = indexed(
    '# 제목',
    '## 1. 개요',
    '[`battle.md`](./battle.md) 를 본다',
    '## 2. 상세',
    '[`battle.md`](./battle.md) 와 [`skill.md`](./skill.md)',
  );
  assert.deepEqual(items(file), [
    '- [`battle.md`](./battle.md) - §1, §2',
    '- [`skill.md`](./skill.md) - §2',
  ]);
});

test('같은 대상의 서로 다른 앵커를 한 줄로 합친다', () => {
  const file = indexed(
    '# 제목',
    '## 1. 개요',
    '[`battle.md` §7](./battle.md#7-승리) 과 [`battle.md` §2](./battle.md#2-흐름)',
  );
  assert.deepEqual(items(file), ['- [`battle.md`](./battle.md) - §1']);
});

test('꼬리 절 안의 링크는 수집하지 않는다', () => {
  const file = indexed(
    '# 제목',
    '## 1. 개요',
    '[`battle.md`](./battle.md)',
    '## 참조',
    '',
    '- [`skill.md`](./skill.md)',
    '',
    '## 변경 이력',
    '',
    '| 2026-01-01 | [`old.md`](./old.md) 흡수 |',
  );
  assert.deepEqual(items(file), ['- [`battle.md`](./battle.md) - §1']);
});

test('앵커 전용 링크는 수집하지 않는다', () => {
  const file = indexed('# 제목', '## 1. 개요', '[1. 개요](#1-개요)');
  assert.deepEqual(referenceBlock(file, cfg), []);
});

test('파일 이름이 겹치면 리포 안 위치를 붙인다', () => {
  const file = at(
    'docs/system/x.md',
    '# 제목',
    '## 1. 개요',
    '[루트](../../CLAUDE.md) 와 [client](../../client/CLAUDE.md) 와 [`battle.md`](../spec/battle.md)',
  );
  assert.deepEqual(items(file), [
    '- [`CLAUDE.md`](../../CLAUDE.md) - §1',
    '- [`client/CLAUDE.md`](../../client/CLAUDE.md) - §1',
    '- [`battle.md`](../spec/battle.md) - §1',
  ]);
});

test('겹치는 이름을 가를 때 상대 경로 앞머리에 기대지 않는다', () => {
  const file = at(
    'client/README.md',
    '# 제목',
    '## 1. 개요',
    '[루트](../CLAUDE.md) 와 [client](./CLAUDE.md)',
  );
  assert.deepEqual(items(file), [
    '- [`CLAUDE.md`](../CLAUDE.md) - §1',
    '- [`client/CLAUDE.md`](./CLAUDE.md) - §1',
  ]);
});

test('코드·데이터를 갈라 담고 디렉터리는 문서 쪽에 둔다', () => {
  const file = indexed(
    '# 제목',
    '## 1. 개요',
    '[a](./a.md) [b](../../client/src/b.ts) [c](../../data/c.json) [d](../spec/)',
  );
  assert.deepEqual(referenceBlock(file, cfg), [
    '',
    '### 문서',
    '',
    '- [`a.md`](./a.md) - §1',
    '- [`spec/`](../spec/) - §1',
    '',
    '### 코드·데이터',
    '',
    '- [`b.ts`](../../client/src/b.ts) - §1',
    '- [`c.json`](../../data/c.json) - §1',
    '',
  ]);
});

test('귀속 절이 없으면 접미사를 생략한다', () => {
  const file = indexed('# 제목', '> 의존: [`battle.md`](./battle.md)', '## 1. 개요');
  assert.deepEqual(items(file), ['- [`battle.md`](./battle.md)']);
});

test('본문 링크가 없으면 참조 절을 만들지 않는다', () => {
  const file = indexed('# 제목', '## 1. 개요', '본문뿐');
  assert.equal(applyReferences(file, file.lines, toIndex(file)), null);
});

test('참조 절이 없으면 첫 꼬리 절 앞에 새로 넣는다', () => {
  const lines = ['# 제목', '## 1. 개요', '[a](./a.md)', '', '## 변경 이력', ''];
  const file = indexed(...lines);
  assert.deepEqual(applyReferences(file, lines, toIndex(file)), [
    '# 제목',
    '## 1. 개요',
    '[a](./a.md)',
    '',
    '## 참조',
    '',
    '### 문서',
    '',
    '- [`a.md`](./a.md) - §1',
    '',
    '## 변경 이력',
    '',
  ]);
});

test('꼬리 절이 하나도 없으면 파일 끝에 붙인다', () => {
  const lines = ['# 제목', '## 1. 개요', '[a](./a.md)', ''];
  const file = indexed(...lines);
  assert.deepEqual(applyReferences(file, lines, toIndex(file)), [
    '# 제목',
    '## 1. 개요',
    '[a](./a.md)',
    '',
    '## 참조',
    '',
    '### 문서',
    '',
    '- [`a.md`](./a.md) - §1',
    '',
  ]);
});

test('참조 절을 채우고 두 번째 실행에서는 바꾸지 않는다', () => {
  const lines = [
    '# 제목',
    '## 1. 개요',
    '[a](./a.md)',
    '## 참조',
    '',
    '- 손으로 쓴 옛 줄',
    '',
    '## 변경 이력',
  ];
  const file = indexed(...lines);
  const first = applyReferences(file, lines, toIndex(file));
  assert.deepEqual(first, [
    '# 제목',
    '## 1. 개요',
    '[a](./a.md)',
    '## 참조',
    '',
    '### 문서',
    '',
    '- [`a.md`](./a.md) - §1',
    '',
    '## 변경 이력',
  ]);
  assert.notEqual(first, null);
  const file2 = indexed(...(first ?? []));
  assert.equal(applyReferences(file2, first ?? [], toIndex(file2)), null);
});
