import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "../config-loader.ts";
import { DEFAULT_CONFIG } from "../config.schema.ts";
import {
  CONFIG_PATH,
  LOCAL_CONFIG_PATH,
  PENDING_PATH,
  PROJECT_PATH,
  RULES_PATH,
  SPECTHREAD_DIR,
  TEMPLATES_DIR,
} from "../constants/paths.ts";
import { renderConfig } from "./config-template.ts";
import {
  renderUpgradePrompt,
  versionSteps,
  type AgentsStatus,
  type UpgradeContext,
} from "./upgrade/index.ts";
import { isLegacyAgents } from "./upgrade/v0.2.ts";

const SPECTHREAD_START = "<!-- specthread:start -->";
const SPECTHREAD_END = "<!-- specthread:end -->";

const scaffoldDir = (): string => {
  const thisFile = dirname(fileURLToPath(import.meta.url));
  // dist/commands, dist, tools/docs/commands (소스에서 실행) 순
  const candidates = [
    join(thisFile, "..", "..", "scaffold"),
    join(thisFile, "..", "scaffold"),
    join(thisFile, "..", "..", "..", "scaffold"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error("scaffold 디렉터리를 찾을 수 없다");
};

type WriteStatus = "created" | "overwritten" | "unchanged" | "skipped" | "kept";

/**
 * 파일 소유. 패키지 파일은 `--force` 면 새 버전으로 바꾸고, 사용자 파일은 `--force` 여도
 * 있으면 건드리지 않는다. 사용자 파일은 처음에 틀만 주고 그 뒤로는 프로젝트 데이터다.
 */
type Owner = "package" | "user";

/** scaffold 에서 프로젝트로 복사할 파일 하나 */
interface ScaffoldFile {
  /** scaffold 안 원본의 절대 경로 */
  src: string;
  /** 프로젝트 루트 기준 대상 경로 */
  dest: string;
  owner: Owner;
}

/** 프로젝트에 쓸 파일 하나 */
interface WriteInput {
  /** 대상의 절대 경로 */
  dest: string;
  content: string;
  force: boolean;
  owner: Owner;
}

const putFile = ({ dest, content, force, owner }: WriteInput): WriteStatus => {
  const existed = existsSync(dest);
  if (existed && owner === "user") return force ? "kept" : "skipped";
  if (existed && !force) return "skipped";
  if (existed && readFileSync(dest, "utf8") === content) return "unchanged";

  const dir = dirname(dest);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(dest, content, "utf8");
  return existed ? "overwritten" : "created";
};

/** scaffold 원본을 읽어 쓴다. `dest` 는 절대 경로다 */
interface CopyInput extends Omit<WriteInput, "content"> {
  /** scaffold 안 원본의 절대 경로 */
  src: string;
}

const copyFile = ({ src, ...rest }: CopyInput): WriteStatus =>
  putFile({ ...rest, content: readFileSync(src, "utf8") });

/** 표식으로 감싼 specthread 섹션. 표식 사이만 패키지가 갱신한다 */
const wrapSection = (section: string): string =>
  `${SPECTHREAD_START}\n${section}\n${SPECTHREAD_END}`;

/** AGENTS.md 의 specthread 섹션을 맞춘다 */
const ensureAgentsMd = (cwd: string, scaffold: string): AgentsStatus => {
  const dest = join(cwd, "AGENTS.md");
  const section = readFileSync(join(scaffold, "AGENTS.md"), "utf8");

  if (!existsSync(dest)) {
    writeFileSync(dest, `${wrapSection(section)}\n`, "utf8");
    console.log("  AGENTS.md 생성");
    return "written";
  }

  const content = readFileSync(dest, "utf8");
  const start = content.indexOf(SPECTHREAD_START);
  if (start >= 0) {
    const end = content.indexOf(SPECTHREAD_END, start);
    // 끝 표식이 없으면 섹션이 어디서 끝나는지 알 수 없다. 추측해서 바꾸면 사용자 내용을 지운다
    if (end < 0) {
      console.log(`  AGENTS.md ${SPECTHREAD_END} 표식 없음. 건드리지 않음`);
      return "broken";
    }
    const after = content.slice(end + SPECTHREAD_END.length);
    writeFileSync(
      dest,
      `${content.slice(0, start)}${wrapSection(section)}${after}`,
      "utf8",
    );
    console.log("  AGENTS.md specthread 섹션 갱신");
    return "written";
  }

  // 0.1 이 표식 없이 만든 파일은 건드리지 않는다. 판별 기준은 upgrade/v0.2.ts 가 갖는다
  if (isLegacyAgents(content)) {
    console.log("  AGENTS.md 이전 버전 형식 (구분 표식 없음). 건드리지 않음");
    return "legacy";
  }

  writeFileSync(
    dest,
    `${content.trimEnd()}\n\n${wrapSection(section)}\n`,
    "utf8",
  );
  console.log("  AGENTS.md specthread 섹션 삽입");
  return "written";
};

const ensureClaudeMd = (cwd: string): void => {
  const dest = join(cwd, "CLAUDE.md");

  if (!existsSync(dest)) {
    writeFileSync(dest, "@AGENTS.md\n", "utf8");
    console.log("  CLAUDE.md 생성");
    return;
  }

  const content = readFileSync(dest, "utf8");
  if (content.includes("@AGENTS.md")) {
    console.log("  CLAUDE.md 이미 @AGENTS.md 참조 포함");
    return;
  }

  writeFileSync(dest, `${content.trimEnd()}\n\n@AGENTS.md\n`, "utf8");
  console.log("  CLAUDE.md @AGENTS.md 추가");
};

/** 개인 설정이 커밋되지 않게 한다. 이미 적혀 있으면 건드리지 않는다 */
const ensureGitignore = (cwd: string): void => {
  const dest = join(cwd, ".gitignore");

  if (!existsSync(dest)) {
    writeFileSync(dest, `${LOCAL_CONFIG_PATH}\n`, "utf8");
    console.log("  .gitignore 생성");
    return;
  }

  const content = readFileSync(dest, "utf8");
  if (content.split(/\r?\n/).some((l) => l.trim() === LOCAL_CONFIG_PATH)) {
    console.log(`  .gitignore 이미 ${LOCAL_CONFIG_PATH} 포함`);
    return;
  }

  writeFileSync(
    dest,
    `${content.trimEnd()}\n\n# specthread 개인 설정\n${LOCAL_CONFIG_PATH}\n`,
    "utf8",
  );
  console.log(`  .gitignore ${LOCAL_CONFIG_PATH} 추가`);
};

const SKILLS = ["plan-open", "plan-run", "plan-close"];

/** 업데이트 프롬프트 구분선. 사용자가 이 사이를 복사해 AI 에 전달한다 */
const PROMPT_START =
  "── 업데이트 프롬프트: 아래를 AI 에게 그대로 전달한다 ──────────────";
const PROMPT_END =
  "──────────────────────────────────────────────────────────────";

const parseTools = (args: string[]): Set<string> => {
  const idx = args.indexOf("--tools");
  if (idx === -1 || idx + 1 >= args.length) return new Set(["claude"]);
  return new Set(args[idx + 1].split(",").map((t) => t.trim().toLowerCase()));
};

const STATUS_LABEL = {
  created: "생성",
  overwritten: "덮어씀",
  unchanged: "변경 없음",
  skipped: "이미 존재. 건너뜀",
  kept: "사용자 파일. 건너뜀",
} as const;

export const init = (args: string[]): void => {
  const cwd = process.cwd();
  const scaffold = scaffoldDir();
  const tools = parseTools(args);
  const force = args.includes("--force");

  if (force) console.log("specthread init --force\n");
  else console.log("specthread init\n");

  const stDir = join(cwd, SPECTHREAD_DIR);
  if (existsSync(stDir)) {
    console.log(`  ${SPECTHREAD_DIR}/ 이미 존재 - 기존 설정 유지`);
  } else {
    mkdirSync(stDir, { recursive: true });
    console.log(`  ${SPECTHREAD_DIR}/ 생성`);
  }

  const configStatus = putFile({
    dest: join(cwd, CONFIG_PATH),
    content: renderConfig(DEFAULT_CONFIG),
    force,
    owner: "user",
  });
  console.log(`  ${CONFIG_PATH} ${STATUS_LABEL[configStatus]}`);

  // 내용이 바뀐 패키지 파일. 업데이트 프롬프트가 사용자 수정분 확인을 요청한다
  const overwritten: string[] = [];
  const put = ({ src, dest, owner }: ScaffoldFile) => {
    const status = copyFile({ src, dest: join(cwd, dest), force, owner });
    if (status === "overwritten") {
      overwritten.push(dest);
    }
    console.log(`  ${dest} ${STATUS_LABEL[status]}`);
  };

  // scaffold 원본은 고정 경로와 같은 파일 이름을 쓴다
  const docs: [string, Owner][] = [
    [RULES_PATH, "package"],
    [PROJECT_PATH, "user"],
    [PENDING_PATH, "user"],
  ];
  for (const [dest, owner] of docs)
    put({ src: join(scaffold, basename(dest)), dest, owner });

  for (const file of ["spec.md", "plan.md"]) {
    put({
      src: join(scaffold, "templates", file),
      dest: `${TEMPLATES_DIR}/${file}`,
      owner: "package",
    });
  }

  const agents = ensureAgentsMd(cwd, scaffold);
  ensureGitignore(cwd);

  if (tools.has("claude")) {
    ensureClaudeMd(cwd);

    for (const name of SKILLS) {
      put({
        src: join(scaffold, "claude", "skills", name, "SKILL.md"),
        dest: `.claude/skills/${name}/SKILL.md`,
        owner: "package",
      });
    }
  }

  const { config, unknown } = readConfig(cwd);
  const ctx: UpgradeContext = {
    root: cwd,
    config,
    unknownKeys: unknown,
    agents,
    overwritten,
    skills: tools.has("claude") ? SKILLS : [],
  };

  if (force) {
    console.log(
      `\n--force 는 패키지 파일만 갱신한다. ${CONFIG_PATH}, ${PROJECT_PATH}, ${PENDING_PATH} 는 그대로 둔다.`,
    );
    console.log(`\n${PROMPT_START}`);
    console.log(renderUpgradePrompt(ctx));
    console.log(PROMPT_END);
    return;
  }

  if (agents === "broken") {
    console.log(
      `\nAGENTS.md 의 specthread 섹션 끝에 ${SPECTHREAD_END} 를 넣고 다시 실행한다.`,
    );
  }
  // 이전 버전의 흔적은 지우지 않는다. 사용자가 고쳤을 수 있어서 프롬프트로 확인을 맡긴다
  if (versionSteps(ctx).length > 0) {
    console.log(
      "\n이전 버전에서 올린 프로젝트로 보인다. `npx specthread init --force` 로 패키지 파일을 갱신하면 남은 정리를 위한 프롬프트를 출력한다.",
    );
  }

  console.log("\n완료. npx specthread check 로 문서 정합성을 확인할 수 있다.");
};
