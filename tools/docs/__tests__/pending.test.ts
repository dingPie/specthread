import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkPending } from '../checks/pending.ts';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import { parseMarkdown } from '../utils/parse.ts';
import type { DocIndex, IndexedFile } from '../types.ts';

/** 관리 문서 한 파일만 담은 색인. 검사가 그 경로만 보므로 이름이 중요하다 */
const indexOf = (lines: string[]): DocIndex => {
  const path = DEFAULT_CONFIG.pending;
  const parsed = parseMarkdown(path, lines);
  const file: IndexedFile = { ...parsed, kind: 'md', lines, sectionRefs: [], ignored: new Set() };
  return {
    files: new Map([[path, file]]),
    docsByName: new Map(),
    config: DEFAULT_CONFIG,
  };
};

const rules = (lines: string[]): string[] =>
  checkPending(indexOf(lines)).map((f) => f.rule);

/**
 * 절 없이 항목만 검사한다.
 *
 * 요약 표는 번호 있는 `##` 절 안에서만 생성되므로, 절을 만들지 않으면 표 검사가
 * 대상 없이 지나간다. 항목 형식만 보는 테스트에서 표 기대값을 함께 적으면
 * 검사 하나를 고칠 때 관계없는 테스트가 무더기로 깨진다.
 */
test('바른 항목은 지적하지 않는다', () => {
  assert.deepEqual(
    rules([
      '# pending',
      '',
      '### `[deps::pierce-step]` pierce 적용 step',
      '',
      '작성일 2026-05-02 / 해결 예정 M2-B',
      '',
      '지금은 `damage_dealt` 에서 걸린다. 의미로는 `damage_calc` 가 맞다.',
      '',
      '- (a) 옮긴다',
      '- (b) 현행 유지',
    ]),
    [],
  );
});

test('항목을 `li` 로 적으면 지적한다', () => {
  assert.deepEqual(
    rules(['- `[deps::x]` 제목 작성일 2026-05-02 / 해결 예정 M3']),
    ['pending/item-shape'],
  );
});

test('작성일 줄이 없으면 지적한다', () => {
  assert.deepEqual(rules(['### `[deps::x]` 제목만 있다']), ['pending/timepoint']);
});

test('작성일을 헤딩에 남기면 지적한다', () => {
  // 헤딩이 곧 앵커라 작성일이 밀릴 때마다 그 항목을 가리키는 링크가 깨진다
  assert.deepEqual(
    rules(['### `[deps::x]` 제목 작성일 2026-05-02 / 해결 예정 M3', '', '작성일 2026-05-02 / 해결 예정 M3']),
    ['pending/timepoint'],
  );
});

test('해결 예정에 달력 날짜를 쓰면 지적한다', () => {
  assert.deepEqual(
    rules(['### `[deps::x]` 제목', '', '작성일 2026-05-02 / 해결 예정 2026-09-01']),
    ['pending/timepoint'],
  );
});

test('해결 예정이 없는 것은 지적하지 않는다', () => {
  assert.deepEqual(rules(['### `[deps::x]` 제목', '', '작성일 2026-05-02']), []);
});

test('헤딩에 본문이 이어붙으면 지적한다', () => {
  assert.deepEqual(
    rules(['### `[deps::x]` 제목. 그리고 본문이 이어진다.', '', '작성일 2026-05-02']),
    ['pending/inline-body'],
  );
});

test('한 줄 안 선택지 둘 이상을 지적한다', () => {
  assert.deepEqual(
    rules(['후보: (a) 옮긴다 / (b) 현행 유지']),
    ['pending/inline-options'],
  );
});

test('선택지 하나는 지적하지 않는다', () => {
  assert.deepEqual(rules(['(a) 만 있으면 나열이 아니다']), []);
});

test('작업 문서 참조를 지적한다', () => {
  assert.deepEqual(
    rules(['출처: [`m2a-st-b6.md`](./work/m2a-st-b6.md) §2-3']),
    ['pending/work-link'],
  );
});

test('변경 이력은 검사하지 않는다', () => {
  // 이력은 과거 기록이라 구 형식과 작업 문서 이름이 남는 것이 정상이다
  assert.deepEqual(
    rules([
      '## 변경 이력',
      '',
      '| 2026-05-02 | `work/x.md` 흡수. 후보 (a) 와 (b) 검토 |',
    ]),
    [],
  );
});

test('절 머리에 요약 표가 없으면 지적한다', () => {
  assert.deepEqual(
    rules([
      '# pending',
      '',
      '## 2. 도메인',
      '',
      '### `[deps::x]` 제목',
      '',
      '작성일 2026-05-02',
    ]),
    ['pending/summary-missing'],
  );
});

test('요약 표가 항목과 맞으면 지적하지 않는다', () => {
  assert.deepEqual(
    rules([
      '# pending',
      '',
      '## 2. 도메인',
      '',
      '| id | 항목 | 해결 예정 | 걸린 곳 |',
      '|----|-----|--------|-------|',
      '| [`deps::x`](#depsx-제목) | 제목 |  |  |',
      '',
      '### `[deps::x]` 제목',
      '',
      '작성일 2026-05-02',
    ]),
    [],
  );
});

test('요약 표가 항목과 어긋나면 지적한다', () => {
  assert.deepEqual(
    rules([
      '# pending',
      '',
      '## 2. 도메인',
      '',
      '| id | 항목 | 해결 예정 | 걸린 곳 |',
      '|----|-----|--------|-------|',
      '| [`deps::x`](#depsx-제목) | 낡은 제목 |  |  |',
      '',
      '### `[deps::x]` 제목',
      '',
      '작성일 2026-05-02',
    ]),
    ['pending/summary-stale'],
  );
});
