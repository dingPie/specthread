import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderConfig } from '../commands/config-template.ts';
import { DEFAULT_CONFIG } from '../config.schema.ts';
import { loadConfig } from '../config-loader.ts';

/** 생성한 config.jsonc 를 실제 로더에 태운다. 렌더러만 보면 문법 오류를 놓친다 */
const loadRendered = (text: string) => {
  const dir = mkdtempSync(join(tmpdir(), 'specthread-'));
  try {
    mkdirSync(join(dir, 'specthread'));
    writeFileSync(join(dir, 'specthread', 'config.jsonc'), text, 'utf8');
    return loadConfig(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
};

test('생성한 config 를 읽으면 기본값과 같다', () => {
  assert.deepEqual(loadRendered(renderConfig(DEFAULT_CONFIG)), DEFAULT_CONFIG);
});

test('확장자 기본값이 주석이 아니라 실제 키로 들어간다', () => {
  const text = renderConfig(DEFAULT_CONFIG);
  const body = text
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n');
  for (const ext of DEFAULT_CONFIG.fileKinds.source) {
    assert.ok(body.includes(`"${ext}"`), `${ext} 가 주석 밖에 없다`);
  }
});

test('값을 바꾸면 생성 결과에 반영된다', () => {
  const custom = {
    ...DEFAULT_CONFIG,
    fileKinds: { doc: ['.md', '.mdx'], source: ['.ts'] },
    markers: { types: ['system', 'design'], timepoints: ['M1'] },
  };
  assert.deepEqual(loadRendered(renderConfig(custom)), custom);
});
