/**
 * 실제 init 결과 위에서 검사·생성을 돌리는 테스트용 도구.
 *
 * 범위 판정은 check 와 gen 이 같은 결과를 내는지가 핵심이라, 각 함수를 따로 부르지 않고
 * 진입점을 그대로 실행한다.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../config-loader.ts';
import { runCheck } from '../run-check.ts';
import { buildIndex } from '../utils/scan.ts';
import type { Finding } from '../types.ts';

const CLI = fileURLToPath(new URL('../bin/cli.ts', import.meta.url));

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export const cli = (cwd: string, ...args: string[]): RunResult => {
  const r = spawnSync(process.execPath, ['--no-warnings', CLI, ...args], { cwd, encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
};

export interface Project {
  root: string;
  write: (path: string, content: string) => void;
  read: (path: string) => string;
  /** 범위 판정을 거친 지적. `파일:줄 규칙` 문자열로 비교하기 쉽게 낸다 */
  check: () => string[];
  findings: () => Finding[];
  gen: () => RunResult;
  dispose: () => void;
}

/** init 을 마친 빈 프로젝트 */
export const makeProject = (): Project => {
  const root = mkdtempSync(join(tmpdir(), 'specthread-e2e-'));
  cli(root, 'init');

  const findings = () => runCheck(buildIndex(root, loadConfig(root)));
  return {
    root,
    write: (path, content) => {
      mkdirSync(dirname(join(root, path)), { recursive: true });
      writeFileSync(join(root, path), content, 'utf8');
    },
    read: (path) => readFileSync(join(root, path), 'utf8'),
    findings,
    check: () => findings().map((f) => `${f.file}:${f.line} ${f.rule}`).sort(),
    gen: () => cli(root, 'gen', '--write'),
    dispose: () => rmSync(root, { recursive: true, force: true }),
  };
};

/** 목차·변경 이력을 갖춘 문서. body 는 `## 1. 개요` 아래에 들어간다 */
export const doc = (title: string, body: string[], tail: string[] = []): string =>
  [
    `# ${title}`,
    '',
    '**목차**',
    '',
    '- [1. 개요](#1-개요)',
    ...tail.map((t) => `- [${t}](#${t.replace(/ /g, '-')})`),
    '- [변경 이력](#변경-이력)',
    '',
    '## 1. 개요',
    '',
    ...body,
    '',
    ...tail.flatMap((t) => [`## ${t}`, '', '해당 없음 - 테스트.', '']),
    '## 변경 이력',
    '',
    '| 날짜 | 내용 |',
    '|-----|-----|',
    '| 2026-10-18 | 작성 |',
    '',
  ].join('\n');
