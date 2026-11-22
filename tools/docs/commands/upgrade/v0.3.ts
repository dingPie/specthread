/**
 * 0.3 에서 바뀐 것: check·gen 스킬 제거.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  bullets,
  type Step,
  type UpgradeContext,
  type VersionUpgrade,
} from "./context.ts";

const REMOVED_SKILLS = ["check", "gen"];

/** 스킬 하나가 놓였던 경로. 0.2 의 `<이름>/SKILL.md` 와 0.1 의 `<이름>.md` */
const skillFiles = (name: string): string[] => [
  `.claude/skills/${name}/SKILL.md`,
  `.claude/skills/${name}.md`,
];

const steps = (ctx: UpgradeContext): Step[] => {
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

export const v0_3: VersionUpgrade = {
  version: "0.3",
  steps,
  staleText: [],
};
