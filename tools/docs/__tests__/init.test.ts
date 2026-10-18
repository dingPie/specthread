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
  '표식 없는 이전 버전 AGENTS.md 는 건드리지 않고 업그레이드 안내를 낸다',
  withProject((p) => {
    p.write('AGENTS.md', SCAFFOLD_AGENTS);
    const r = cli(p.root, 'init', '--force');
    assert.equal(p.read('AGENTS.md'), SCAFFOLD_AGENTS);
    assert.match(r.stdout, /0\.1\.x 에서 올리기/);
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
    assert.match(r.stdout, /0\.1\.x 에서 올리기/);
    assert.ok(existsSync(join(p.root, '.claude/skills/check/SKILL.md')));
  }),
);
