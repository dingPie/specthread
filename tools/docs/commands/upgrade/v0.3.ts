/**
 * 0.3 에서 바뀐 것: check·gen 스킬 제거, 꼬리 절 이름 "미확정 사항" → "보류 사항".
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { TAIL } from "../../constants/docs.ts";
import {
  PENDING_PATH,
  PROJECT_PATH,
  TEMPLATES_DIR,
} from "../../constants/paths.ts";
import type { Heading } from "../../types.ts";
import { underPath } from "../../utils/path-match.ts";
import { buildIndex } from "../../utils/scan.ts";
import {
  bullets,
  type Step,
  type UpgradeContext,
  type VersionUpgrade,
} from "./context.ts";

const REMOVED_SKILLS = ["check", "gen"];

const OLD_PENDING_TAIL = "미확정 사항";

/** 스킬 하나가 놓였던 경로. 0.2 의 `<이름>/SKILL.md` 와 0.1 의 `<이름>.md` */
const skillFiles = (name: string): string[] => [
  `.claude/skills/${name}/SKILL.md`,
  `.claude/skills/${name}.md`,
];

const skillSteps = (ctx: UpgradeContext): Step[] => {
  if (ctx.skills.length === 0) return [];

  const exists = (path: string): boolean => existsSync(join(ctx.root, path));
  const candidates = REMOVED_SKILLS.flatMap(skillFiles);
  const found = candidates.filter(exists);
  if (found.length === 0) return [];

  const step = [
    "아래 스킬은 패키지에서 제거됐어. 내가 고친 부분이 없으면 지우고, 있으면 알려줘.",
    ...bullets(found),
  ];
  return [step];
};

const hasOldTail = (headings: Heading[]): boolean =>
  headings.some((h) => h.level === 2 && h.raw === OLD_PENDING_TAIL);

/** 옛 꼬리 절 제목이 남은 문서. 색인으로 찾아서 코드 블록 안 예시는 대상이 아니다 */
const oldTailDocs = (ctx: UpgradeContext): string[] => {
  const index = buildIndex(ctx.root, ctx.config);
  const docs: string[] = [];

  for (const file of index.files.values()) {
    const isTemplate = underPath(file.path, TEMPLATES_DIR);
    if (isTemplate || !hasOldTail(file.headings)) {
      continue;
    }
    docs.push(file.path);
  }

  return docs.sort();
};

const tailSteps = (ctx: UpgradeContext): Step[] => {
  const docs = oldTailDocs(ctx);
  if (docs.length === 0) return [];

  const step = [
    `아래 문서의 \`## ${OLD_PENDING_TAIL}\` 절 제목을 \`## ${TAIL.PENDING}\` 으로 바꿔줘. ` +
      "목차와 그 절 내용은 마지막 단계의 `gen --write` 가 다시 만들어.",
    ...bullets(docs),
  ];
  return [step];
};

const steps = (ctx: UpgradeContext): Step[] => [
  ...skillSteps(ctx),
  ...tailSteps(ctx),
];

export const v0_3: VersionUpgrade = {
  version: "0.3",
  steps,
  staleText: [
    {
      file: PROJECT_PATH,
      before: "## 2. 마커와 미확정 사항",
      after: "## 2. 마커와 보류 사항",
    },
    {
      file: PROJECT_PATH,
      before: "[`rules.md` §4](./rules.md#4-미확정-관리)",
      after: "[`rules.md` §4](./rules.md#4-보류-관리)",
    },
    {
      file: PROJECT_PATH,
      before: "### 2-2. 미확정 사항 파일",
      after: "### 2-2. 보류 사항 파일",
    },
    {
      file: PENDING_PATH,
      before: "각 문서 하단의 `## 미확정 사항` 섹션은",
      after: "각 문서 하단의 `## 보류 사항` 섹션은",
    },
    {
      file: PENDING_PATH,
      before: "| 각 문서 `## 미확정 사항` |",
      after: "| 각 문서 `## 보류 사항` |",
    },
  ],
};
