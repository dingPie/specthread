/**
 * 생성기 진입점. `specthread gen` (미리보기) / `--write` (적용)
 *
 * 기본이 미리보기다. 문서를 고치는 도구가 확인 없이 쓰면 되돌리기가 어렵다.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RuleGroup } from "../constants/rules.ts";
import { buildIndex } from "../utils/scan.ts";
import { groupAllowed, isDoc, tailOrderOk } from "../utils/scope.ts";
import { applyToc } from "../gen/toc.ts";
import { applyReferences } from "../gen/references.ts";
import { applySummary } from "../gen/summary.ts";
import { applyPendingSection } from "../gen/pending-section.ts";
import type { DocIndex, IndexedFile } from "../types.ts";
import { openProject } from "./open-project.ts";

/** 생성기 하나. 색인을 받는 것은 문서 밖 값을 세는 생성기가 있기 때문이다 */
type Generator = (
  file: IndexedFile,
  lines: string[],
  index: DocIndex,
) => string[] | null;

/**
 * 생성기와 그 결과를 검사하는 규칙군. skipCheck 가 그 군을 빼면 생성도 하지 않는다 -
 * 검사하지 않는 문서에 생성물을 넣으면 그 생성물이 맞는지 아무도 보지 않는다.
 */
interface Step {
  apply: Generator;
  group: RuleGroup;
}

const write = process.argv.includes("--write");
const { root, config } = openProject();
const { features } = config;

/**
 * 한 문서에 걸 생성기 목록. **문서 아래쪽을 고치는 것부터** 둔다.
 *
 * 색인의 줄 번호는 원본 기준이라, 위쪽을 먼저 고치면 아래쪽 생성기가 밀린 줄을
 * 가리킨다. 반대 순서면 앞 생성기가 건드린 범위가 뒤 생성기의 범위 밖이라 안전하다.
 */
const STEPS: Step[] = [
  ...(features.markers ? [{ apply: applyPendingSection, group: "pending" as const }] : []),
  ...(features.references ? [{ apply: applyReferences, group: "reference" as const }] : []),
  ...(features.markers ? [{ apply: applySummary, group: "pending" as const }] : []),
  { apply: applyToc, group: "toc" },
];

const index = buildIndex(root, config);

const changed: string[] = [];
const skipped: string[] = [];
for (const file of index.files.values()) {
  if (!isDoc(file)) continue;

  const steps = STEPS.filter((s) => groupAllowed(file.path, s.group, config));
  if (steps.length === 0) continue;

  // 아래쪽부터 고치는 순서가 꼬리 절 순서를 전제한다. 어긋나면 엉뚱한 범위를 덮어쓴다
  if (!tailOrderOk(file.headings)) {
    skipped.push(file.path);
    continue;
  }

  let next = file.lines;
  for (const { apply } of steps) {
    next = apply(file, next, index) ?? next;
  }

  // 바꿀 것이 없는 문서는 목록에 올리지 않는다
  if (next === file.lines) continue;

  changed.push(file.path);

  if (write) {
    writeFileSync(join(root, file.path), next.join("\n"), "utf8");
  }
}

const mode = write ? "적용" : "미리보기";
console.log(`문서 생성 ${mode} - ${changed.length} 건`);
for (const path of changed) {
  console.log(`  ${path}`);
}
if (skipped.length > 0) {
  console.log(`\n꼬리 절 순서가 어긋나 건너뜀 - ${skipped.length} 건 (heading/tail-order)`);
  for (const path of skipped) console.log(`  ${path}`);
}
if (!write && changed.length > 0) {
  console.log("\n실제로 쓰려면 --write");
}
