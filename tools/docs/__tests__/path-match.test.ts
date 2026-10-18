import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizeConfigPath, underPath } from '../utils/path-match.ts';

test('설정 경로의 ./, 끝 /, 중복 /, 역슬래시를 정리한다', () => {
  assert.equal(normalizeConfigPath('docs/work/'), 'docs/work');
  assert.equal(normalizeConfigPath('./docs/work'), 'docs/work');
  assert.equal(normalizeConfigPath('././docs//work//'), 'docs/work');
  assert.equal(normalizeConfigPath('docs\\work\\'), 'docs/work');
  assert.equal(normalizeConfigPath('/docs/'), 'docs');
  assert.equal(normalizeConfigPath('./'), '');
  assert.equal(normalizeConfigPath('CLAUDE.md'), 'CLAUDE.md');
});

test('디렉터리 경계로 판정한다', () => {
  assert.equal(underPath('docs/a.md', 'docs'), true);
  assert.equal(underPath('docs/x/a.md', 'docs'), true);
  assert.equal(underPath('docs-old/a.md', 'docs'), false);
  assert.equal(underPath('docs/workshop.md', 'docs/work'), false);
});

test('파일 경로를 정확히 적으면 그 파일 하나에 해당한다', () => {
  assert.equal(underPath('CLAUDE.md', 'CLAUDE.md'), true);
  assert.equal(underPath('client/CLAUDE.md', 'CLAUDE.md'), false);
  assert.equal(underPath('CLAUDE.md.bak', 'CLAUDE.md'), false);
});

test('빈 경로는 루트 전체다', () => {
  assert.equal(underPath('a/b.md', ''), true);
});
