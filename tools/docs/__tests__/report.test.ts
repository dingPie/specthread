import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cli, makeProject, type Project } from './project-fixture.ts';

const withProject = (fn: (p: Project) => void) => () => {
  const p = makeProject();
  try {
    fn(p);
  } finally {
    p.dispose();
  }
};

test(
  'check 는 규칙별 집계에 해결 방법을 함께 낸다',
  withProject((p) => {
    p.write(
      'docs/a.md',
      ['# a', '', '**목차**', '', '- [1. 개요](#1-개요)', '', '## 1. 개요', '', '## 2. 범위', ''].join('\n'),
    );
    const r = cli(p.root, 'check');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /toc\/stale +→ npx specthread gen --write$/m);
  }),
);

test(
  'gen 은 꼬리 절 순서로 건너뛴 문서에 해결 방법을 함께 낸다',
  withProject((p) => {
    p.write(
      'docs/a.md',
      [
        '# a',
        '',
        '**목차**',
        '',
        '- [1. 개요](#1-개요)',
        '- [변경 이력](#변경-이력)',
        '- [참조](#참조)',
        '',
        '## 1. 개요',
        '',
        '## 변경 이력',
        '',
        '## 참조',
        '',
      ].join('\n'),
    );
    const r = p.gen();
    assert.match(r.stdout, /건너뜀 - 1 건/);
    assert.match(r.stdout, /→ 꼬리 절을 참조 → 미확정 사항 → 변경 이력 순서로 옮긴 뒤 npx specthread gen --write/);
  }),
);
