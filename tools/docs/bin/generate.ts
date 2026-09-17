/**
 * 생성기 진입점. `pnpm docs:generate` (미리보기) / `--write` (적용)
 *
 * 기본이 미리보기다. 문서를 고치는 도구가 확인 없이 쓰면 되돌리기가 어렵다.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadConfig } from "../config-loader.ts";
import { buildIndex, REPO_ROOT } from "../utils/scan.ts";
import { isTargetDoc } from "../utils/scope.ts";
import { applyToc } from "../gen/toc.ts";
import { applyReferences } from "../gen/references.ts";
import { applySummary } from "../gen/summary.ts";
import { applyPendingSection } from "../gen/pending-section.ts";
import type { DocIndex, IndexedFile } from "../types.ts";

/** 생성기 하나. 색인을 받는 것은 문서 밖 값을 세는 생성기가 있기 때문이다 */
type Generator = (
  file: IndexedFile,
  lines: string[],
  index: DocIndex,
) => string[] | null;

/**
 * 한 문서에 걸 생성기 목록. **문서 아래쪽을 고치는 것부터** 둔다.
 *
 * 색인의 줄 번호는 원본 기준이라, 위쪽을 먼저 고치면 아래쪽 생성기가 밀린 자리를
 * 가리킨다. 반대 순서면 앞 생성기가 건드린 범위가 뒤 생성기의 범위 밖이라 안전하다.
 */
const write = process.argv.includes("--write");
const config = loadConfig();
const { features } = config;

const GENERATORS: Generator[] = [
  ...(features.markers ? [applyPendingSection] : []),
  ...(features.references ? [applyReferences] : []),
  ...(features.markers ? [applySummary] : []),
  applyToc,
];

const index = buildIndex(config);
const files = index.files.values();

const changed: string[] = [];
for (const file of files) {
  if (!isTargetDoc(file, index.config)) continue;

  let next = file.lines;
  for (const apply of GENERATORS) {
    next = apply(file, next, index) ?? next;
  }

  // 바꿀 것이 없는 문서는 목록에 올리지 않는다
  if (next === file.lines) continue;

  changed.push(file.path);

  if (write) {
    writeFileSync(join(REPO_ROOT, file.path), next.join("\n"), "utf8");
  }
}

const mode = write ? "적용" : "미리보기";
console.log(`문서 생성 ${mode} - ${changed.length} 건`);
for (const path of changed) {
  console.log(`  ${path}`);
}
if (!write && changed.length > 0) {
  console.log("\n실제로 쓰려면 --write");
}
