/**
 * check 가 지적하는 것과 gen 이 고치는 것의 범위가 같은지.
 *
 * 범위가 다르면 gen 으로 해소할 수 없는 지적이 남거나, 검사하지 않는 문서를 gen 이 고친다.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { doc, makeProject, type Project } from './project-fixture.ts';

const withProject = (fn: (p: Project) => void) => () => {
  const p = makeProject();
  try {
    fn(p);
  } finally {
    p.dispose();
  }
};

/** 목차가 낡고, 마커가 고아이고, 링크가 깨진 문서 */
const broken = (title: string): string =>
  [
    `# ${title}`,
    '',
    '**목차**',
    '',
    '- [옛 절](#옛-절)',
    '',
    '## 1. 개요',
    '',
    '[`없음`](./nothing.md) `PENDING::system::ghost`',
    '',
    '## 미확정 사항',
    '',
    '- 손으로 쓴 줄',
    '',
  ].join('\n');

test(
  'skipCheck 문자열 경로는 모든 군의 지적이 사라지고 gen 도 고치지 않는다',
  withProject((p) => {
    p.write('specthread/config.local.jsonc', '{ "skipCheck": ["./docs/archive/"] }');
    p.write('docs/archive/old.md', broken('old'));
    assert.deepEqual(p.check(), []);
    p.gen();
    assert.equal(p.read('docs/archive/old.md'), broken('old'));
  }),
);

test(
  'skipCheck 객체 항목은 only 의 군만 남기고, 그 밖의 생성물은 만들지 않는다',
  withProject((p) => {
    p.write('specthread/config.local.jsonc', '{ "skipCheck": [{ "path": "docs/drafts", "only": ["link"] }] }');
    p.write('docs/drafts/d.md', broken('d'));
    // 목차의 깨진 앵커도 link 군이라 남는다
    assert.deepEqual(p.check(), ['docs/drafts/d.md:5 link/anchor', 'docs/drafts/d.md:9 link/target']);
    p.gen();
    assert.equal(p.read('docs/drafts/d.md'), broken('d'));
  }),
);

test(
  'skipRefs 는 경로 아래의 문서에 참조 절을 요구하지도 만들지도 않는다',
  withProject((p) => {
    p.write('specthread/config.local.jsonc', '{ "skipRefs": ["docs/drafts/"] }');
    p.write('docs/b.md', doc('B', ['내용.']));
    p.write('docs/drafts/a.md', doc('A', ['[`b.md`](../b.md) 참고.']));
    assert.deepEqual(p.check(), []);
    const r = p.gen();
    assert.match(r.stdout, /적용 - 0 건/);
  }),
);

test(
  'work 는 디렉터리 경계로 판정한다 - 낡은 미확정 절이 있는 docs/workshop.md 는 지적되고 gen 이 고친다',
  withProject((p) => {
    p.write('specthread/config.local.jsonc', '{ "work": "docs/work" }');
    p.write('docs/workshop.md', doc('W', ['내용.'], ['미확정 사항']));
    assert.deepEqual(p.check(), ['docs/workshop.md:14 pending/section-stale']);
    p.gen();
    assert.deepEqual(p.check(), []);
  }),
);

test(
  '억제 주석이 붙은 목차는 check 가 지적하지 않고 gen 도 고치지 않는다',
  withProject((p) => {
    const text = doc('A', ['내용.']).replace('**목차**', '<!-- @specthread-ignore 손으로 관리 -->\n**목차**').replace(
      '- [1. 개요](#1-개요)',
      '- [개요만](#1-개요)',
    );
    p.write('docs/a.md', text);
    assert.deepEqual(p.check(), []);
    p.gen();
    assert.equal(p.read('docs/a.md'), text);
  }),
);

test(
  '꼬리 절 순서가 어긋난 문서는 지적하고 gen 은 건너뛴다',
  withProject((p) => {
    p.write('docs/b.md', doc('B', ['내용.']));
    const text = [
      '# A',
      '',
      '**목차**',
      '',
      '- [1. 개요](#1-개요)',
      '- [미확정 사항](#미확정-사항)',
      '- [참조](#참조)',
      '- [변경 이력](#변경-이력)',
      '',
      '## 1. 개요',
      '',
      '[`b.md`](./b.md) 참고.',
      '',
      '## 미확정 사항',
      '',
      '## 참조',
      '',
      '## 변경 이력',
      '',
    ].join('\n');
    p.write('docs/a.md', text);
    assert.ok(p.check().includes('docs/a.md:14 heading/tail-order'));
    const r = p.gen();
    assert.match(r.stdout, /건너뜀 - 1 건/);
    assert.equal(p.read('docs/a.md'), text);
  }),
);

test(
  '생성된 미확정 사항 절의 줄은 대상 문서 기준으로 검사하지 않는다',
  withProject((p) => {
    p.write('docs/a.md', doc('A', ['`PENDING::system::foo`'], ['미확정 사항']));
    p.write(
      'specthread/pending.md',
      p
        .read('specthread/pending.md')
        .replace(
          '## 참조',
          [
            '## 2. 시스템',
            '',
            '### `[system::foo]` 제목에 [링크](./rules.md) 와 §2 가 있다',
            '',
            '작성일 2026-10-18',
            '',
            '참조: [`a.md`](../docs/a.md)',
            '',
            '## 참조',
          ].join('\n'),
        ),
    );
    p.gen();
    assert.match(p.read('docs/a.md'), /\[`system::foo`\]/);
    assert.deepEqual(
      p.check().filter((f) => f.startsWith('docs/a.md')),
      [],
    );
  }),
);

test(
  '같은 문서 앵커 링크와 ./ 없는 상대 링크 안의 절 참조를 해소한다',
  withProject((p) => {
    p.write('docs/b.md', doc('B', ['내용.']));
    p.write('docs/a.md', doc('A', ['[§1](#1-개요) 과 [`b.md` §1](b.md#1-개요) 참고.']));
    p.gen();
    assert.deepEqual(p.check(), []);
  }),
);
