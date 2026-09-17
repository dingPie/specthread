import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import type { RuleGroup } from '../constants/rules.ts';
import { isCheckTarget, isWorkExempt, wantsRefSection } from '../utils/scope.ts';
import type { Finding, IndexedFile } from '../types.ts';
import { parseMarkdown } from '../utils/parse.ts';

const config = {
  ...DEFAULT_CONFIG,
  skipCheck: [
    'docs/archive/',
    'docs/retrospective/',
    { path: 'docs/work/', only: ['toc', 'reference'] as RuleGroup[] },
  ],
  skipRefs: ['CLAUDE.md', 'client/CLAUDE.md'],
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

// ── isCheckTarget (string 형 skipCheck) ──

test('skipCheck string 경로에 해당하면 검사 대상이 아니다', () => {
  assert.equal(isCheckTarget('docs/archive/old.md', config), false);
  assert.equal(isCheckTarget('docs/retrospective/v1.md', config), false);
});

test('skipCheck 에 해당하지 않으면 검사 대상이다', () => {
  assert.equal(isCheckTarget('docs/spec/battle.md', config), true);
  assert.equal(isCheckTarget('docs/pending.md', config), true);
});

// ── isWorkExempt (객체형 skipCheck) ──

test('초안 문서의 규칙 지적은 걸러낸다', () => {
  assert.equal(isWorkExempt(f('docs/work/x.md', 'timestamp/body-date'), config), true);
  assert.equal(isWorkExempt(f('docs/work/x.md', 'section-ref/missing'), config), true);
  assert.equal(isWorkExempt(f('docs/work/x.md', 'changelog/order'), config), true);
});

test('초안 문서라도 생성 관련 지적은 남긴다', () => {
  assert.equal(isWorkExempt(f('docs/work/x.md', 'toc/stale'), config), false);
  assert.equal(isWorkExempt(f('docs/work/x.md', 'reference/stale'), config), false);
});

test('초안 문서가 아니면 그대로 둔다', () => {
  assert.equal(isWorkExempt(f('docs/spec/battle.md', 'timestamp/body-date'), config), false);
  assert.equal(isWorkExempt(f('docs/pending.md', 'changelog/order'), config), false);
});

// ── wantsRefSection (skipRefs) ──

test('skipRefs 에 등록된 경로는 참조 절을 만들지 않는다', () => {
  const file = md('CLAUDE.md', '# CLAUDE', '## 1. 원칙', '내용');
  assert.equal(wantsRefSection(file, config), false);
});

test('skipRefs 에 없는 문서는 참조 절 대상이다', () => {
  const file = md('docs/spec/battle.md', '# battle', '## 1. 개요', '내용');
  assert.equal(wantsRefSection(file, config), true);
});

test('skipCheck 로 제외된 문서는 참조 절 대상도 아니다', () => {
  const file = md('docs/archive/old.md', '# old', '## 1. 내용', '텍스트');
  assert.equal(wantsRefSection(file, config), false);
});
