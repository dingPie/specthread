/**
 * `init --force` 가 마지막에 출력하는 업데이트 프롬프트.
 *
 * 사용자가 AI 에 그대로 붙여 넣는 글이다. init 이 감지한 상태에 해당하는 단계만 넣고,
 * 검사와 생성 단계는 항상 넣는다. 버전을 올리며 정리할 것이 생기면 감지 항목을 더한다.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readConfig, REMOVED_KEYS, type RemovedKey } from "../config-loader.ts";
import { DEFAULT_CONFIG, type PathConfig } from "../config.schema.ts";
import {
  CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  PENDING_PATH,
  PROJECT_PATH,
  SPECTHREAD_DIR,
} from "../constants/paths.ts";
import { normalizeConfigPath, underPath } from "../utils/path-match.ts";

/** AGENTS.md 처리 결과. `legacy`·`broken` 은 파일을 고치지 않은 경우다 */
export type AgentsStatus = "written" | "legacy" | "broken";

/** init 이 넘겨주는 상태 */
export interface UpgradeInput {
  root: string;
  agents: AgentsStatus;
  /** 내용이 바뀐 패키지 파일 */
  overwritten: string[];
  /** `<이름>/SKILL.md` 가 아닌 이전 경로에 남은 스킬 파일 */
  oldSkills: string[];
}

/** 사용자 파일에 남은 옛 scaffold 문구와 지금 문구 */
interface StaleText {
  file: string;
  before: string;
  after: string;
}

/**
 * 사용자 파일은 `--force` 로도 덮어쓰지 않는다. scaffold 의 사용자 파일 문구를 바꾸면
 * 옛 문구를 여기에 더해 업데이트 프롬프트가 고치게 한다.
 */
const STALE_TEXT: StaleText[] = [
  {
    file: PROJECT_PATH,
    before: "`config.jsonc` 에서 경로를 override 할 수 있다.",
    after: "경로는 `specthread/pending.md` 고정이다.",
  },
  {
    file: PENDING_PATH,
    before: "**종류마다 `##` 섹션이 하나씩 생긴다.** 종류 값은 `config.markers.types` 가 정의하며,",
    after:
      "**종류마다 `##` 섹션을 하나씩 둔다.** 섹션은 사람이 만들고, 종류 값은 `config.markers.types` 에 있어야 한다.",
  },
];

/** 규약 파일 경로를 정하던 키. 값을 적어 썼다면 파일을 `specthread/` 아래로 옮겨야 한다 */
const PATH_KEYS = new Set(["rules", "pending", "project"]);

interface RemovedEntry extends RemovedKey {
  /** 주석으로만 남아 있는지 */
  commented: boolean;
}

/** 주석 줄에 남은 제거된 키. 기본값을 주석으로 적어 둔 설정 파일에서 나온다 */
const commentedKeys = (text: string): string[] =>
  Object.keys(REMOVED_KEYS).filter((key) => {
    const name = key.slice(key.lastIndexOf(".") + 1);
    return new RegExp(`^\\s*//.*"${name}"\\s*:`, "m").test(text);
  });

const removedKeys = (root: string, live: RemovedKey[]): RemovedEntry[] => {
  const out: RemovedEntry[] = live.map((r) => ({ ...r, commented: false }));
  for (const file of [CONFIG_PATH, LOCAL_CONFIG_PATH]) {
    const abs = join(root, file);
    if (!existsSync(abs)) continue;
    for (const key of commentedKeys(readFileSync(abs, "utf8"))) {
      if (!out.some((r) => r.file === file && r.key === key)) out.push({ file, key, commented: true });
    }
  }
  return out;
};

const staleText = (root: string): StaleText[] =>
  STALE_TEXT.filter(({ file, before }) => {
    const abs = join(root, file);
    return existsSync(abs) && readFileSync(abs, "utf8").includes(before);
  });

/**
 * 기본 스캔 경로 중 설정에서 빠진 것. 그 디렉터리가 있을 때만 본다.
 *
 * `path` 는 기본값과 합치지 않고 통째로 교체하므로 일부 키만 적으면 기본 경로가 빠진다.
 * `specthread/` 의 규약 파일은 `path` 와 관계없이 읽으므로 대상에서 뺀다.
 */
const uncoveredDefaults = (root: string, path: PathConfig): string[] => {
  const bases = Object.values(path).flat().map(normalizeConfigPath);
  return Object.values(DEFAULT_CONFIG.path)
    .flat()
    .map(normalizeConfigPath)
    .filter((d) => d !== SPECTHREAD_DIR && existsSync(join(root, d)))
    .filter((d) => !bases.some((b) => underPath(b, d) || underPath(d, b)));
};

/** 단계 하나. 첫 줄이 지시이고 나머지 줄은 그 아래 들여 쓴다 */
type Step = string[];

const bullets = (items: string[]): string[] => items.map((item) => `- ${item}`);

const HEADER = [
  "specthread 패키지 파일을 새 버전으로 갱신했다. 아래를 순서대로 처리해줘.",
  "내가 직접 쓴 내용은 지우지 말고, 판단이 필요하면 멈추고 물어봐.",
];

export const renderUpgradePrompt = (input: UpgradeInput): string => {
  const { config, removed: live } = readConfig(input.root);
  const steps: Step[] = [];

  if (input.agents === "broken") {
    steps.push([
      "`AGENTS.md` 에 `<!-- specthread:start -->` 는 있고 `<!-- specthread:end -->` 가 없다. " +
        "specthread 섹션이 끝나는 줄 다음에 끝 표식을 넣고 `npx specthread init` 을 다시 실행한다.",
    ]);
  }

  if (input.agents === "legacy") {
    steps.push([
      "`AGENTS.md` 의 specthread 섹션을 `<!-- specthread:start -->` 와 `<!-- specthread:end -->` 로 감싼다. " +
        "섹션은 `# specthread` 제목부터 그 섹션 끝까지이고, 그 밖의 내용은 그대로 둔다.",
      ...bullets([
        "specthread 섹션이 두 번 들어 있으면 뒤의 것을 지운다.",
        "감싼 뒤 `npx specthread init` 을 다시 실행해 섹션을 새 버전으로 바꾼다.",
      ]),
    ]);
  }

  if (input.overwritten.length > 0) {
    steps.push([
      "아래 파일을 새 버전으로 덮어썼다. git diff 로 확인하고, 내가 고쳐 둔 내용이 사라졌으면 알려줘.",
      ...bullets(input.overwritten),
    ]);
  }

  if (input.oldSkills.length > 0) {
    steps.push([
      "아래 옛 스킬 파일을 같은 이름의 `<이름>/SKILL.md` 와 비교한다. 내가 고친 부분이 없으면 지우고, 있으면 알려줘.",
      ...bullets(input.oldSkills),
    ]);
  }

  const removed = removedKeys(input.root, live);
  if (removed.length > 0) {
    const pathKeyInUse = removed.some((r) => !r.commented && PATH_KEYS.has(r.key));
    steps.push([
      "설정 파일에서 제거된 키를 지운다. 주석으로만 남은 것은 그 설명 주석까지 지운다.",
      ...bullets(removed.map((r) => `${r.file}: ${r.key}${r.commented ? " (주석)" : ""}`)),
      ...(pathKeyInUse
        ? [
            "`rules`·`pending`·`project` 에 경로를 적어 쓰고 있었다면 지우지 말고 알려줘. " +
              "경로가 `specthread/` 아래로 고정이라 파일을 옮겨야 한다.",
          ]
        : []),
    ]);
  }

  const stale = staleText(input.root);
  if (stale.length > 0) {
    steps.push([
      "사용자 파일의 옛 문구를 지금 문구로 바꾼다.",
      ...bullets(stale.map((s) => `${s.file}: "${s.before}" → "${s.after}"`)),
    ]);
  }

  const uncovered = uncoveredDefaults(input.root, config.path);
  if (uncovered.length > 0) {
    steps.push([
      "`config.path` 가 아래 경로를 스캔하지 않는다. `path` 는 기본값과 합치지 않고 통째로 교체되므로, " +
        "일부 키만 적으면 기본 경로가 빠진다. 의도한 것인지 물어봐.",
      ...bullets(uncovered.map((d) => `${d}/`)),
    ]);
  }

  steps.push([
    "`npx specthread check` 를 실행하고 지적을 고친다.",
    ...bullets([
      "종료 코드 2 로 끝나면 출력된 설정 파일과 키부터 고친다.",
      "`marker/unknown-type` 이 나오면 쓰고 있는 종류를 `config.markers.types` 에 추가할지 물어봐.",
      "`heading/tail-order` 가 나오면 꼬리 절을 참조 → 미확정 사항 → 변경 이력 순서로 옮긴다.",
    ]),
  ]);

  steps.push(["`npx specthread gen --write` 를 실행한 뒤 `npx specthread check` 가 0 건인지 확인한다."]);

  const body = steps.flatMap(([first, ...rest], i) => [
    `${i + 1}. ${first}`,
    ...rest.map((line) => `   ${line}`),
    "",
  ]);
  return [...HEADER, "", ...body].join("\n").trimEnd();
};
