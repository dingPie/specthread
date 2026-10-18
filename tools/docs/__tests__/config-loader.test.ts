import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigError, loadConfig } from '../config-loader.ts';
import { DEFAULT_CONFIG } from '../config.schema.ts';

const load = (text: string, local?: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'specthread-'));
  try {
    mkdirSync(join(dir, 'specthread'));
    writeFileSync(join(dir, 'specthread', 'config.jsonc'), text, 'utf8');
    if (local !== undefined) writeFileSync(join(dir, 'specthread', 'config.local.jsonc'), local, 'utf8');
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
  assert.deepEqual(config.skipRefs, ['docs/a']);
});

test('주석 뒤에 오는 닫는 괄호 앞 쉼표도 지운다', () => {
  const config = load(`{
  "skipRefs": ["docs/a/", // 설명
    /* 블록 */ ],
}`);
  assert.deepEqual(config.skipRefs, ['docs/a']);
});

test('문자열 안의 쉼표와 괄호는 건드리지 않는다', () => {
  const config = load(`{ "ignoreDocNames": ["a,]", "b,}", "c\\",]"], }`);
  assert.deepEqual(config.ignoreDocNames, ['a,]', 'b,}', 'c",]']);
});

/** 경고 출력을 잡는다. 테스트 출력에 섞이지 않게 한다 */
const captureWarn = (fn: () => void): string[] => {
  const out: string[] = [];
  const orig = console.warn;
  console.warn = (msg: string) => out.push(msg);
  try {
    fn();
  } finally {
    console.warn = orig;
  }
  return out;
};

const problemsOf = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    if (e instanceof ConfigError) return e.problems.map((p) => `${p.file} ${p.key}`);
    throw e;
  }
  return [];
};

test('path 는 키 단위로 합치지 않고 통째로 교체한다', () => {
  const config = load('{ "path": { "src": ["source/"] } }');
  assert.deepEqual(config.path, { src: ['source/'] });
});

test('그 밖의 객체는 키 단위로 합친다', () => {
  const config = load('{ "features": { "references": false } }');
  assert.deepEqual(config.features, { markers: true, references: false });
});

test('타입이 틀린 값은 파일과 키를 담아 모두 모아 던진다', () => {
  assert.deepEqual(
    problemsOf(() =>
      load('{ "skipCheck": "docs/", "features": { "markers": "false" } }', '{ "path": { "docs": "docs/" } }'),
    ),
    [
      'specthread/config.jsonc skipCheck',
      'specthread/config.jsonc features.markers',
      'specthread/config.local.jsonc path.docs',
    ],
  );
});

test('only 가 없는 skipCheck 객체 항목은 오류다', () => {
  assert.deepEqual(problemsOf(() => load('{ "skipCheck": [{ "path": "docs/" }] }')), [
    'specthread/config.jsonc skipCheck',
  ]);
});

test('JSONC 문법 오류는 파일명을 담는다', () => {
  assert.deepEqual(problemsOf(() => load('{ "work": }')), ['specthread/config.jsonc ']);
});

test('제거한 키는 경고만 하고 동작한다', () => {
  let config = DEFAULT_CONFIG;
  const warnings = captureWarn(() => {
    config = load('{ "locale": "ko", "pending": "docs/pending.md", "features": { "emDash": true } }');
  });
  assert.equal(warnings.length, 3);
  assert.ok(warnings.every((w) => w.includes('제거된 키')));
  assert.deepEqual(config, DEFAULT_CONFIG);
});

test('알 수 없는 키는 경고하고 무시한다', () => {
  const warnings = captureWarn(() => load('{ "feature": { "markers": false } }'));
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0].includes('feature'));
});

test('경로 값을 정규화한다', () => {
  const config = load('{ "work": "./docs/plans/", "skipCheck": ["./docs/archive/", { "path": "docs\\\\x/", "only": [] }] }');
  assert.equal(config.work, 'docs/plans');
  assert.deepEqual(config.skipCheck, ['docs/archive', { path: 'docs/x', only: [] }]);
});
