import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import type { RuleGroup } from '../constants/rules.ts';
import { allowedGroups, isSkipped, tailOrderOk, wantsRefSection } from '../utils/scope.ts';
import type { Finding, IndexedFile } from '../types.ts';
import { parseHeadings, parseMarkdown } from '../utils/parse.ts';

const config = {
  ...DEFAULT_CONFIG,
  skipCheck: [
    'docs/archive',
    'docs/retrospective',
    { path: 'docs/work', only: ['toc', 'reference'] as RuleGroup[] },
  ],
  skipRefs: ['CLAUDE.md', 'docs/drafts'],
};

const f = (file: string, rule: Finding['rule']): Finding => ({
  file,
  line: 1,
  rule,
  message: '',
});

const md = (path: string, ...lines: string[]): IndexedFile => ({
  ...parseMarkdown(path, lines),
  sectionRefs: [],
  ignored: new Set(),
});

// ── skipCheck 문자열 항목 ──

test('skipCheck 문자열 경로 아래의 지적은 군과 관계없이 전부 버린다', () => {
  assert.equal(isSkipped(f('docs/archive/old.md', 'toc/stale'), config), true);
  assert.equal(isSkipped(f('docs/archive/old.md', 'marker/orphan'), config), true);
  assert.equal(isSkipped(f('docs/retrospective/v1.md', 'pending/section-stale'), config), true);
});

test('skipCheck 는 디렉터리 경계로 판정한다', () => {
  assert.equal(isSkipped(f('docs/archive-old/x.md', 'toc/stale'), config), false);
  assert.equal(isSkipped(f('docs/spec/battle.md', 'toc/stale'), config), false);
});

// ── skipCheck 객체 항목 ──

test('객체 항목은 only 의 군만 남긴다', () => {
  assert.equal(isSkipped(f('docs/work/x.md', 'timestamp/body-date'), config), true);
  assert.equal(isSkipped(f('docs/work/x.md', 'section-ref/missing'), config), true);
  assert.equal(isSkipped(f('docs/work/x.md', 'toc/stale'), config), false);
  assert.equal(isSkipped(f('docs/work/x.md', 'reference/stale'), config), false);
});

test('여러 항목이 걸리면 모두 허용하는 군만 남는다', () => {
  const c = {
    ...DEFAULT_CONFIG,
    skipCheck: [
      { path: 'docs', only: ['toc', 'link'] as RuleGroup[] },
      { path: 'docs/a', only: ['toc'] as RuleGroup[] },
    ],
  };
  assert.deepEqual([...(allowedGroups('docs/a/x.md', c) ?? [])], ['toc']);
  assert.deepEqual([...(allowedGroups('docs/b/x.md', c) ?? [])].sort(), ['link', 'toc']);
});

// ── 기본 제외 ──

test('템플릿과 설정 파일은 skipCheck 를 적지 않아도 제외한다', () => {
  assert.equal(isSkipped(f('specthread/templates/spec.md', 'toc/stale'), DEFAULT_CONFIG), true);
  assert.equal(isSkipped(f('specthread/config.jsonc', 'section-ref/missing'), DEFAULT_CONFIG), true);
  assert.equal(isSkipped(f('specthread/rules.md', 'toc/stale'), DEFAULT_CONFIG), false);
});

test('사용자가 skipCheck 를 적어도 기본 제외는 유지된다', () => {
  assert.equal(isSkipped(f('specthread/templates/plan.md', 'toc/stale'), config), true);
});

// ── skipRefs ──

test('skipRefs 경로 아래의 문서는 참조 절을 만들지 않는다', () => {
  assert.equal(wantsRefSection(md('CLAUDE.md', '# CLAUDE'), config), false);
  assert.equal(wantsRefSection(md('docs/drafts/a.md', '# a'), config), false);
});

test('skipRefs 에 해당하지 않는 문서는 참조 절 대상이다', () => {
  assert.equal(wantsRefSection(md('docs/spec/battle.md', '# battle'), config), true);
  assert.equal(wantsRefSection(md('client/CLAUDE.md', '# CLAUDE'), config), true);
});

// ── 꼬리 절 순서 ──

test('꼬리 절 순서를 판정한다. 없는 절은 건너뛴다', () => {
  assert.equal(tailOrderOk(parseHeadings(['# a', '## 참조', '## 미확정 사항', '## 변경 이력'])), true);
  assert.equal(tailOrderOk(parseHeadings(['# a', '## 참조', '## 변경 이력'])), true);
  assert.equal(tailOrderOk(parseHeadings(['# a', '## 미확정 사항', '## 참조'])), false);
  assert.equal(tailOrderOk(parseHeadings(['# a', '## 변경 이력', '## 미확정 사항'])), false);
});
