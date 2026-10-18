import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadConfig } from '../config-loader.ts';

const load = (text: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'specthread-'));
  try {
    mkdirSync(join(dir, 'specthread'));
    writeFileSync(join(dir, 'specthread', 'config.jsonc'), text, 'utf8');
    return loadConfig(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('trailing comma 를 허용한다 - Prettier 가 .jsonc 에 기본으로 넣는다', () => {
  const config = load(`{
  "markers": {
    "types": ["system", "design",],
    "timepoints": ["M1",],
  },
  "skipRefs": [
    "docs/a/",
  ],
}
`);
  assert.deepEqual(config.markers, { types: ['system', 'design'], timepoints: ['M1'] });
  assert.deepEqual(config.skipRefs, ['docs/a/']);
});

test('주석 뒤에 오는 닫는 괄호 앞 쉼표도 지운다', () => {
  const config = load(`{
  "skipRefs": ["docs/a/", // 설명
    /* 블록 */ ],
}`);
  assert.deepEqual(config.skipRefs, ['docs/a/']);
});

test('문자열 안의 쉼표와 괄호는 건드리지 않는다', () => {
  const config = load(`{ "ignoreDocNames": ["a,]", "b,}", "c\\",]"], }`);
  assert.deepEqual(config.ignoreDocNames, ['a,]', 'b,}', 'c",]']);
});
