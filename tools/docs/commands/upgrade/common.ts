/**
 * 버전과 관계없이 매번 보는 업데이트 단계.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_CONFIG, type PathConfig } from "../../config.schema.ts";
import { normalizeConfigPath, underPath } from "../../utils/path-match.ts";
import { bullets, type Step, type UpgradeContext } from "./context.ts";

/** 버전 단계보다 먼저 처리할 것. AGENTS.md 와 패키지 파일 상태 */
export const leadingSteps = (ctx: UpgradeContext): Step[] => {
  const steps: Step[] = [];

  if (ctx.agents === "broken") {
    steps.push([
      "`AGENTS.md` 에 `<!-- specthread:start -->` 는 있는데 `<!-- specthread:end -->` 가 없어. " +
        "specthread 섹션이 끝나는 줄 다음에 끝 표식을 넣고 `npx specthread init` 을 다시 실행해줘.",
    ]);
  }

  if (ctx.overwritten.length > 0) {
    steps.push([
      "아래 파일을 새 버전으로 덮어썼어. git diff 로 확인하고, 내가 고쳐 둔 내용이 사라졌으면 알려줘.",
      ...bullets(ctx.overwritten),
    ]);
  }

  return steps;
};

/** 기본 스캔 경로 중 설정에서 빠진 것. `path` 는 기본값과 합치지 않고 통째로 교체된다 */
const uncoveredDefaults = (root: string, path: PathConfig): string[] => {
  const bases = Object.values(path).flat().map(normalizeConfigPath);
  const defaults = Object.values(DEFAULT_CONFIG.path)
    .flat()
    .map(normalizeConfigPath);

  const covered = (d: string): boolean =>
    bases.some((b) => underPath(b, d) || underPath(d, b));
  const missing = (d: string): boolean =>
    existsSync(join(root, d)) && !covered(d);

  return defaults.filter(missing);
};

/** 버전 단계 다음에 처리할 것. 설정 점검과 검사·생성 */
export const trailingSteps = (ctx: UpgradeContext): Step[] => {
  const steps: Step[] = [];

  const uncovered = uncoveredDefaults(ctx.root, ctx.config.path);
  if (uncovered.length > 0) {
    const dirs = uncovered.map((d) => `${d}/`);
    steps.push([
      "`config.path` 가 아래 경로를 검사하지 않아. `path` 는 기본값과 합쳐지지 않고 통째로 바뀌어서, " +
        "일부 키만 적으면 기본 경로가 빠져. 의도한 건지 물어봐.",
      ...bullets(dirs),
    ]);
  }

  steps.push([
    "`npx specthread check` 를 실행하고 지적을 고쳐줘. 규칙마다 고치는 방법이 출력 끝에 나와.",
    ...bullets([
      "종료 코드 2로 끝나면 출력된 설정 파일과 키부터 고쳐줘.",
      "`marker/unknown-type` 이 나오면 쓰고 있는 종류를 `config.markers.types` 에 추가할지 물어봐.",
    ]),
  ]);

  steps.push([
    "`npx specthread gen --write` 를 실행한 다음 `npx specthread check` 가 지적 없이 끝나는지 확인해줘.",
  ]);

  return steps;
};
