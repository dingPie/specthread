#!/usr/bin/env node
/**
 * em dash (—) 를 하이픈으로 자동 치환하는 PostToolUse 훅.
 *
 * 작성자가 키보드에서 입력할 수 없는 문자라 사람이 손으로 고친 문서와
 * 에이전트가 쓴 문서가 계속 갈라지는 것을 막는다.
 * 치환은 뜻을 바꾸지 않으므로 조용히 고치고, 몇 곳을 고쳤는지만 알린다.
 *
 * config.features.emDash 가 false 면 이 훅을 등록하지 않는다.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SKIP = ['/.claude/projects/', '/node_modules/'];

const SELF = 'tools/hooks/no-em-dash.mjs';

const TEXT = /\.(md|mdx|ts|tsx|js|jsx|mjs|cjs|json|jsonc|html|css|txt|yml|yaml)$/;

const main = () => {
  let payload;
  try {
    payload = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    return;
  }

  const path = payload?.tool_input?.file_path;
  if (typeof path !== 'string' || !TEXT.test(path)) return;
  if (SKIP.some((s) => path.includes(s)) || path.endsWith(SELF)) return;

  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return;
  }

  const hits = (text.match(/—/g) ?? []).length;
  if (hits === 0) return;

  writeFileSync(path, text.replaceAll('—', '-'));
  process.stderr.write(`em dash ${hits} 곳을 '-' 로 고쳤다: ${path}\n`);
};

main();
