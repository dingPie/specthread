/**
 * `init --force` 가 마지막에 출력하는 업데이트 프롬프트.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { leadingSteps, trailingSteps } from "./common.ts";
import {
  bullets,
  type StaleText,
  type Step,
  type UpgradeContext,
  type VersionUpgrade,
} from "./context.ts";
import { v0_2 } from "./v0.2.ts";
import { v0_3 } from "./v0.3.ts";

export type { AgentsStatus, UpgradeContext } from "./context.ts";

/** 오래된 버전부터 */
export const VERSIONS: readonly VersionUpgrade[] = [v0_2, v0_3];

const HEADER = [
  "specthread 패키지 파일을 새 버전으로 갱신했어. 아래 단계를 순서대로 처리해줘.",
  "",
  "- 내가 직접 쓴 내용은 지우지 마.",
  "- 판단이 필요하면 그 단계에서 멈추고 물어봐.",
  "- 다 끝나면 바꾼 파일과 내가 확인해야 할 것을 짧게 정리해줘.",
];

const staleText = (root: string): StaleText[] => {
  const all = VERSIONS.flatMap((v) => v.staleText);
  const remains = ({ file, before }: StaleText): boolean => {
    const abs = join(root, file);
    return existsSync(abs) && readFileSync(abs, "utf8").includes(before);
  };

  return all.filter(remains);
};

const formatStale = (s: StaleText): string =>
  `${s.file}: "${s.before}" → "${s.after}"`;

/** 이전 버전에서 남은 것을 정리하는 단계. 없으면 빈 배열이다 */
export const versionSteps = (ctx: UpgradeContext): Step[] => {
  const steps = VERSIONS.flatMap((v) => v.steps(ctx));

  const stale = staleText(ctx.root);
  if (stale.length > 0) {
    steps.push([
      "사용자 파일에 남은 옛 문구를 지금 문구로 바꿔줘.",
      ...bullets(stale.map(formatStale)),
    ]);
  }

  return steps;
};

const renderStep = (step: Step, index: number): string[] => {
  const [first, ...rest] = step;
  const indented = rest.map((line) => `   ${line}`);
  return [`${index + 1}. ${first}`, ...indented, ""];
};

export const renderUpgradePrompt = (ctx: UpgradeContext): string => {
  const steps = [
    ...leadingSteps(ctx),
    ...versionSteps(ctx),
    ...trailingSteps(ctx),
  ];
  const body = steps.flatMap(renderStep);
  return [...HEADER, "", ...body].join("\n").trimEnd();
};
