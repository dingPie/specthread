/**
 * 0.2 에서 바뀐 것: AGENTS.md 구분 표식, 스킬 경로, 규약 경로 고정과 설정 키 정리, 사용자 파일 문구.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigKey } from "../../config-loader.ts";
import {
  CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  PENDING_PATH,
  PROJECT_PATH,
} from "../../constants/paths.ts";
import {
  bullets,
  type Step,
  type UpgradeContext,
  type VersionUpgrade,
} from "./context.ts";

/** 0.1 이 표식 없이 만든 AGENTS.md 인지. init 이 쓰기 전에 호출해서 그 파일은 건드리지 않는다 */
export const isLegacyAgents = (content: string): boolean =>
  /^# specthread\s*$/m.test(content) &&
  /^## 2\. SDD 작업 흐름\s*$/m.test(content);

const REMOVED_KEYS = new Set([
  "locale",
  "docTypes",
  "rules",
  "pending",
  "project",
  "features.emDash",
]);

/** 규약 파일 경로를 정하던 키. 값을 적어 썼다면 파일을 옮겨야 한다 */
const PATH_KEYS = new Set(["rules", "pending", "project"]);

interface RemovedEntry extends ConfigKey {
  /** 주석으로만 남아 있는지 */
  commented: boolean;
}

/** 기본값을 주석으로 적어 둔 설정 파일에 남은 제거된 키 */
const commentedKeys = (text: string): string[] => {
  const inComment = (key: string): boolean => {
    const name = key.slice(key.lastIndexOf(".") + 1);
    return new RegExp(`^\\s*//.*"${name}"\\s*:`, "m").test(text);
  };
  return [...REMOVED_KEYS].filter(inComment);
};

const removedKeys = (ctx: UpgradeContext): RemovedEntry[] => {
  const live = ctx.unknownKeys.filter((k) => REMOVED_KEYS.has(k.key));
  const out: RemovedEntry[] = live.map((k) => ({ ...k, commented: false }));

  for (const file of [CONFIG_PATH, LOCAL_CONFIG_PATH]) {
    const abs = join(ctx.root, file);
    if (!existsSync(abs)) {
      continue;
    }
    for (const key of commentedKeys(readFileSync(abs, "utf8"))) {
      const listed = out.some((r) => r.file === file && r.key === key);
      if (!listed) {
        out.push({ file, key, commented: true });
      }
    }
  }
  return out;
};

const formatRemoved = (r: RemovedEntry): string => {
  const note = r.commented ? " (주석)" : "";
  return `${r.file}: ${r.key}${note}`;
};

const removedKeyStep = (removed: RemovedEntry[]): Step => {
  const step = [
    "설정 파일에서 제거된 키를 지워줘. 주석으로만 남은 키는 그 설명 주석까지 지워줘.",
    ...bullets(removed.map(formatRemoved)),
  ];

  const pathKeyInUse = removed.some((r) => !r.commented && PATH_KEYS.has(r.key));
  if (pathKeyInUse) {
    step.push(
      "`rules`·`pending`·`project` 에 경로를 적어 쓰고 있었다면 지우지 말고 먼저 알려줘. " +
        "이 파일들은 이제 `specthread/` 아래로 위치가 고정돼서 파일을 옮겨야 해.",
    );
  }
  return step;
};

const steps = (ctx: UpgradeContext): Step[] => {
  const out: Step[] = [];

  if (ctx.agents === "legacy") {
    out.push([
      "`AGENTS.md` 의 specthread 섹션을 `<!-- specthread:start -->` 와 `<!-- specthread:end -->` 로 감싸줘. " +
        "섹션은 `# specthread` 제목부터 그 섹션 끝까지야. 그 밖의 내용은 그대로 둬.",
      ...bullets([
        "specthread 섹션이 두 번 들어 있으면 뒤의 것을 지워줘.",
        "감싼 다음 `npx specthread init` 을 다시 실행해서 섹션을 새 버전으로 바꿔줘.",
      ]),
    ]);
  }

  // Claude Code 는 `<이름>/SKILL.md` 만 스킬로 읽는다
  const exists = (path: string): boolean => existsSync(join(ctx.root, path));
  const oldPaths = ctx.skills.map((name) => `.claude/skills/${name}.md`);
  const oldSkills = oldPaths.filter(exists);
  if (oldSkills.length > 0) {
    out.push([
      "아래 스킬 파일은 예전 경로에 남아 있어. 같은 이름의 `<이름>/SKILL.md` 와 비교해서, 내가 고친 부분이 없으면 지우고 있으면 알려줘.",
      ...bullets(oldSkills),
    ]);
  }

  const removed = removedKeys(ctx);
  if (removed.length > 0) {
    out.push(removedKeyStep(removed));
  }

  return out;
};

export const v0_2: VersionUpgrade = {
  version: "0.2",
  steps,
  staleText: [
    {
      file: PROJECT_PATH,
      before: "`config.jsonc` 에서 경로를 override 할 수 있다.",
      after: "경로는 `specthread/pending.md` 고정이다.",
    },
    {
      file: PENDING_PATH,
      before:
        "**종류마다 `##` 섹션이 하나씩 생긴다.** 종류 값은 `config.markers.types` 가 정의하며,",
      after:
        "**종류마다 `##` 섹션을 하나씩 둔다.** 섹션은 사람이 만들고, 종류 값은 `config.markers.types` 에 있어야 한다.",
    },
  ],
};
