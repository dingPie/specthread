import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { CONFIG_PATH, PENDING_PATH, PROJECT_PATH, RULES_PATH } from '../constants/paths.ts';
import { cli, makeProject, type Project } from './project-fixture.ts';

const SCAFFOLD_AGENTS = readFileSync(
  fileURLToPath(new URL('../../../scaffold/AGENTS.md', import.meta.url)),
  'utf8',
);

const withProject = (fn: (p: Project) => void) => () => {
  const p = makeProject();
  try {
    fn(p);
  } finally {
    p.dispose();
  }
};

const count = (text: string, needle: string): number => text.split(needle).length - 1;

/** `init --force` 출력에서 구분선 사이의 업데이트 프롬프트 */
const promptOf = (stdout: string): string => {
  const m = /── 업데이트 프롬프트[^\n]*\n([\s\S]*?)\n─+\n/.exec(stdout);
  assert.ok(m, '업데이트 프롬프트가 없다');
  return m[1];
};

/** 프롬프트 단계 번호 목록 */
const stepNumbers = (prompt: string): number[] =>
  [...prompt.matchAll(/^(\d+)\. /gm)].map((m) => Number(m[1]));

test(
  '첫 init 은 AGENTS.md 를 표식으로 감싸 만들고, 다시 실행해도 섹션이 하나다',
  withProject((p) => {
    assert.equal(count(p.read('AGENTS.md'), '<!-- specthread:start -->'), 1);
    cli(p.root, 'init');
    cli(p.root, 'init', '--force');
    const text = p.read('AGENTS.md');
    assert.equal(count(text, '<!-- specthread:start -->'), 1);
    assert.equal(count(text, '\n# specthread\n'), 1);
  }),
);

test(
  '--force 는 패키지 파일만 갱신하고 사용자 파일은 그대로 둔다',
  withProject((p) => {
    const user = [CONFIG_PATH, PROJECT_PATH, PENDING_PATH];
    for (const path of [...user, RULES_PATH]) p.write(path, `손으로 고침 ${path}\n`);

    const r = cli(p.root, 'init', '--force');

    for (const path of user) assert.equal(p.read(path), `손으로 고침 ${path}\n`);
    assert.notEqual(p.read(RULES_PATH), `손으로 고침 ${RULES_PATH}\n`);
    assert.match(r.stdout, /사용자 파일\. 건너뜀/);
  }),
);

test(
  '표식 없는 이전 버전 AGENTS.md 는 건드리지 않고 프롬프트에 감싸는 단계를 넣는다',
  withProject((p) => {
    p.write('AGENTS.md', SCAFFOLD_AGENTS);
    const r = cli(p.root, 'init', '--force');
    assert.equal(p.read('AGENTS.md'), SCAFFOLD_AGENTS);
    assert.match(promptOf(r.stdout), /^1\. `AGENTS\.md` 의 specthread 섹션을 .* 감싼다/m);
  }),
);

test(
  '끝 표식이 없는 AGENTS.md 는 건드리지 않고 표식을 넣으라고 안내한다',
  withProject((p) => {
    const broken = '# 내 프로젝트\n\n<!-- specthread:start -->\n# specthread\n';
    p.write('AGENTS.md', broken);

    const plain = cli(p.root, 'init');
    assert.equal(p.read('AGENTS.md'), broken);
    assert.match(plain.stdout, /<!-- specthread:end --> 를 넣고 다시 실행한다/);

    const forced = cli(p.root, 'init', '--force');
    assert.equal(p.read('AGENTS.md'), broken);
    assert.match(promptOf(forced.stdout), /^1\. .*`<!-- specthread:end -->` 가 없다/m);
  }),
);

test(
  '사용자가 만든 AGENTS.md 에는 끝에 섹션을 붙인다',
  withProject((p) => {
    p.write('AGENTS.md', '# 내 프로젝트\n\n내용\n');
    cli(p.root, 'init');
    const text = p.read('AGENTS.md');
    assert.ok(text.startsWith('# 내 프로젝트\n\n내용\n'));
    assert.equal(count(text, '<!-- specthread:start -->'), 1);
  }),
);

test(
  '옛 경로의 스킬 파일이 있으면 지우지 않고 업그레이드 안내를 낸다',
  withProject((p) => {
    p.write('.claude/skills/check.md', '옛 스킬\n');
    const r = cli(p.root, 'init');
    assert.equal(p.read('.claude/skills/check.md'), '옛 스킬\n');
    assert.match(r.stdout, /\.claude\/skills\/check\.md/);
    assert.match(r.stdout, /npx specthread init --force/);
    assert.ok(existsSync(join(p.root, '.claude/skills/check/SKILL.md')));
  }),
);

test(
  '바뀐 것이 없으면 --force 프롬프트는 검사와 생성 단계만 담는다',
  withProject((p) => {
    const r = cli(p.root, 'init', '--force');
    assert.match(r.stdout, /specthread\/rules\.md 변경 없음/);
    const prompt = promptOf(r.stdout);
    assert.deepEqual(stepNumbers(prompt), [1, 2]);
    assert.match(prompt, /^1\. `npx specthread check`/m);
    assert.match(prompt, /^2\. `npx specthread gen --write`/m);
  }),
);

test(
  '--force 프롬프트는 감지한 항목만 순서대로 담는다',
  withProject((p) => {
    p.write(RULES_PATH, '손으로 고친 규칙\n');
    p.write(
      CONFIG_PATH,
      [
        '{',
        '  "path": { "src": ["src/"] },',
        '  "features": { "emDash": true },',
        '  // "rules": "specthread/rules.md",',
        '}',
      ].join('\n'),
    );
    p.write(PROJECT_PATH, '이름은 pending.md 다. `config.jsonc` 에서 경로를 override 할 수 있다.\n');
    p.write('docs/a.md', '# a\n');

    const prompt = promptOf(cli(p.root, 'init', '--force').stdout);

    assert.deepEqual(stepNumbers(prompt), [1, 2, 3, 4, 5, 6]);
    assert.match(prompt, /^1\. 아래 파일을 새 버전으로 덮어썼다.*\n {3}- specthread\/rules\.md$/m);
    assert.match(prompt, /^ {3}- specthread\/config\.jsonc: features\.emDash$/m);
    assert.match(prompt, /^ {3}- specthread\/config\.jsonc: rules \(주석\)$/m);
    // 주석으로만 남은 경로 키는 옮길 파일이 없다
    assert.doesNotMatch(prompt, /파일을 옮겨야 한다/);
    assert.match(prompt, new RegExp(`^ {3}- ${PROJECT_PATH}: "\`config\.jsonc\` 에서 경로를 override`, 'm'));
    assert.match(prompt, /^ {3}- docs\/$/m);
  }),
);
