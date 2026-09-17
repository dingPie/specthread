/**
 * 색인 조립 - 대상 파일을 모아 파싱하고 참조를 해소한다.
 *
 * 검사기와 생성기가 모두 이 색인 하나를 쓴다.
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative, normalize } from "node:path";
import { parseIgnoredLines } from "./ignore.ts";
import { parseMarkdown, parseMarkers } from "./parse.ts";
import { makeRefContext, parseSectionRefs } from "./resolve.ts";
import type { DocIndex, FileKind, IndexedFile } from "../types.ts";
import type { SpecthreadConfig } from "../config.schema.ts";

/** 프로젝트 루트 절대 경로. 색인 경로를 여기 기준 상대 경로로 통일하는 데 쓴다 */
export const REPO_ROOT = normalize(process.cwd());

/** 확장자로 파일 종류를 결정한다 */
const kindFromPath = (file: string): FileKind | null => {
  if (/\.md$/i.test(file)) return "md";
  if (/\.tsx?$/.test(file)) return "code";
  if (/\.json$/.test(file)) return "json";
  return null;
};

/** 디렉터리를 재귀로 훑어 파일 경로를 모은다. `node_modules` 와 숨김 디렉터리는 건너뛴다 */
const walk = (dir: string, out: string[] = []): string[] => {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
};

/**
 * config.path 에서 대상 파일을 모은다.
 *
 * 값이 디렉터리면 재귀 스캔, 파일이면 직접 로드. 파싱 전략은 확장자로 결정한다.
 * 인식하지 못하는 확장자는 건너뛴다.
 */
const collectTargets = (
  pathConfig: Record<string, string[]>,
): { path: string; kind: FileKind }[] => {
  const out: { path: string; kind: FileKind }[] = [];
  const seen = new Set<string>();

  const add = (abs: string) => {
    const rel = relative(REPO_ROOT, abs);
    if (seen.has(rel)) return;
    const kind = kindFromPath(rel);
    if (kind === null) return;
    seen.add(rel);
    out.push({ path: rel, kind });
  };

  for (const paths of Object.values(pathConfig)) {
    for (const entry of paths) {
      const abs = join(REPO_ROOT, entry);
      if (!existsSync(abs)) continue;
      if (statSync(abs).isDirectory()) {
        for (const file of walk(abs)) add(file);
      } else {
        add(abs);
      }
    }
  }

  return out;
};

/**
 * 색인을 만든다. 검사기와 생성기의 유일한 입력이다.
 *
 * 참조 해소 문맥을 먼저 만들어야 하므로 문서 목록을 두 번 본다 - 한 번은 이름 색인을
 * 위해, 한 번은 실제 파싱을 위해. 코드와 JSON 은 헤딩이 없어서 빈 값으로 채운다.
 */
export const buildIndex = (config: SpecthreadConfig): DocIndex => {
  const targets = collectTargets(config.path);
  const mdPaths = targets.filter((t) => t.kind === "md").map((t) => t.path);
  const ctx = makeRefContext(mdPaths, config.ignoreDocNames);

  const files = new Map<string, IndexedFile>();
  for (const { path, kind } of targets) {
    const lines = readFileSync(join(REPO_ROOT, path), "utf8").split("\n");
    const sectionRefs = parseSectionRefs(path, kind, lines, ctx);
    const ignored = parseIgnoredLines(lines);
    if (kind === "md") {
      files.set(path, { ...parseMarkdown(path, lines), sectionRefs, ignored });
    } else {
      files.set(path, {
        path,
        kind,
        lines,
        headings: [],
        links: [],
        sectionRefs,
        markers: parseMarkers(lines, kind),
        pendingItems: [],
        tocBlock: null,
        refSection: null,
        pendingSection: null,
        changeLogRange: null,
        changeLogDates: [],
        ignored,
      });
    }
  }

  return { files, docsByName: ctx.nameMap, config };
};
