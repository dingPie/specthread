import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkMarkers } from '../checks/markers.ts';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import { parseMarkdown } from '../utils/parse.ts';
import type { DocIndex, IndexedFile } from '../types.ts';

const md = (path: string, ...lines: string[]): IndexedFile => ({
  ...parseMarkdown(path, lines),
  sectionRefs: [],
  ignored: new Set(),
});

const indexOf = (files: IndexedFile[]): DocIndex => ({
  files: new Map(files.map((f) => [f.path, f])),
  docsByName: new Map(),
  config: DEFAULT_CONFIG,
});

const PENDING = md(
  DEFAULT_CONFIG.pending,
  '# pending',
  '## 2. 도메인',
  '### `[deps::pierce-step]` pierce 적용 step',
  '',
  '작성일 2026-05-02',
);

test('마커 slug 가 관리 문서 항목과 맞으면 지적하지 않는다', () => {
  const spec = md('docs/spec/battle.md', '# battle', 'PENDING::deps::pierce-step 여기 걸린다');
  const findings = checkMarkers(indexOf([PENDING, spec]));
  assert.deepEqual(findings, []);
});

test('관리 문서에 없는 마커는 고아로 잡는다', () => {
  // pierce-step 을 걸지 않았으니 그쪽은 미확정으로도 함께 잡힌다 - 둘은 독립된 검사다
  const spec = md('docs/spec/battle.md', '# battle', 'PENDING::deps::nonexistent 여기');
  const findings = checkMarkers(indexOf([PENDING, spec]));
  assert.deepEqual(
    findings.map((f) => f.rule).sort(),
    ['marker/orphan', 'marker/unmarked'],
  );
});

test('마커가 하나도 없는 항목은 미확정으로 잡는다', () => {
  const findings = checkMarkers(indexOf([PENDING]));
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['marker/unmarked'],
  );
});

test('@specthread-ignore 가 붙은 항목은 마커가 없어도 지적하지 않는다', () => {
  const pending: IndexedFile = {
    ...parseMarkdown(DEFAULT_CONFIG.pending, [
      '# pending',
      '## 3. 시스템',
      '<!-- @specthread-ignore -->',
      '### `[system::rules-autoload]` 규칙 문서 자동 로드 여부',
      '',
      '작성일 2026-08-11',
    ]),
    sectionRefs: [],
    ignored: new Set([3, 4]),
  };
  const findings = checkMarkers(indexOf([pending]));
  assert.deepEqual(findings, []);
});

test('구 형식 마커는 대조 대상이 아니다', () => {
  const spec = md('docs/spec/battle.md', '# battle', 'TEMP_BALANCE (M1): 잠정값');
  const findings = checkMarkers(indexOf([PENDING, spec]));
  assert.deepEqual(
    findings.map((f) => f.rule),
    ['marker/unmarked'], // pierce-step 만 미확정으로 잡히고, 구 형식은 무시된다
  );
});
