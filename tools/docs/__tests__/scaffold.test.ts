import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../config-loader.ts';
import { TEMPLATES_DIR } from '../constants/paths.ts';
import { collectFindings } from '../run-check.ts';
import { isIgnored } from '../utils/ignore.ts';
import { buildIndex } from '../utils/scan.ts';
import { cli, makeProject } from './project-fixture.ts';

const project = makeProject();
after(() => project.dispose());

test('새로 init 한 프로젝트는 check 0 건, gen 0 건이다', () => {
  assert.deepEqual(project.check(), []);
  const r = cli(project.root, 'gen');
  assert.match(r.stdout, /미리보기 - 0 건/);
});

test('scaffold 템플릿은 기본 제외 없이 검사해도 지적이 없다', () => {
  // 사용자 프로젝트에서는 템플릿을 검사하지 않으므로, 템플릿 자체의 형식은 여기서만 검증된다
  const index = buildIndex(project.root, loadConfig(project.root));
  const findings = collectFindings(index)
    .filter((f) => f.file.startsWith(`${TEMPLATES_DIR}/`) && !isIgnored(index, f))
    .map((f) => `${f.file}:${f.line} ${f.rule} ${f.message}`);
  assert.deepEqual(findings, []);
});

test('하위 디렉터리에서 실행해도 루트 기준으로 검사한다', () => {
  mkdirSync(join(project.root, 'docs', 'sub'), { recursive: true });
  const r = cli(join(project.root, 'docs', 'sub'), 'check');
  assert.equal(r.status, 0);
  assert.match(r.stdout, /문서 [1-9]/);
});

test('설정 파일이 없으면 종료 코드 2 로 끝난다', () => {
  const dir = mkdtempSync(join(tmpdir(), 'specthread-empty-'));
  try {
    const r = cli(dir, 'check');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /specthread init/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('설정 타입 오류는 파일과 키를 출력하고 종료 코드 2 로 끝난다', () => {
  const p = makeProject();
  try {
    p.write('specthread/config.local.jsonc', '{ "skipCheck": "docs/" }');
    const r = cli(p.root, 'gen');
    assert.equal(r.status, 2);
    assert.match(r.stderr, /specthread\/config\.local\.jsonc skipCheck/);
  } finally {
    p.dispose();
  }
});
