import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { VERSIONS } from '../commands/upgrade/index.ts';

const scaffoldText = (file: string): string => {
  const url = new URL(`../../../scaffold/${basename(file)}`, import.meta.url);
  return readFileSync(fileURLToPath(url), 'utf8');
};

test('버전 파일은 오래된 버전부터 놓인다', () => {
  const versions = VERSIONS.map((v) => v.version.split('.').map(Number));
  const byVersion = (a: number[], b: number[]): number => a[0] - b[0] || a[1] - b[1];
  const sorted = [...versions].sort(byVersion);
  assert.deepEqual(versions, sorted);
});

test('사용자 파일의 옛 문구는 지금 scaffold 에 없고, 바꿀 문구는 있다', () => {
  // 나중 버전이 같은 문구를 다시 바꾸면 실패한다. 앞 버전의 after 도 현재 문구로 고친다
  for (const { version, staleText } of VERSIONS) {
    for (const { file, before, after } of staleText) {
      const text = scaffoldText(file);
      const where = `${version} ${file}`;
      assert.ok(!text.includes(before), `${where}: 옛 문구가 아직 scaffold 에 있다 - ${before}`);
      assert.ok(text.includes(after), `${where}: 바꿀 문구가 scaffold 에 없다 - ${after}`);
    }
  }
});
