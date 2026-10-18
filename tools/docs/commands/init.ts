import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
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

type WriteStatus = "created" | "overwritten" | "skipped" | "kept";

/**
 * 파일 소유. 패키지 파일은 `--force` 면 새 버전으로 바꾸고, 사용자 파일은 `--force` 여도
 * 있으면 건드리지 않는다. 사용자 파일은 처음에 틀만 주고 그 뒤로는 프로젝트 데이터다.
 */
type Owner = "package" | "user";

const putFile = (dest: string, content: string, force: boolean, owner: Owner): WriteStatus => {
  const existed = existsSync(dest);
  if (existed && owner === "user") return force ? "kept" : "skipped";
  if (existed && !force) return "skipped";
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(dest, content, "utf8");
  return existed ? "overwritten" : "created";
};

const copyFile = (src: string, dest: string, force: boolean, owner: Owner): WriteStatus =>
  putFile(dest, readFileSync(src, "utf8"), force, owner);

/** 표식으로 감싼 specthread 섹션. 표식 사이만 패키지가 갱신한다 */
const wrapSection = (section: string): string => `${SPECTHREAD_START}\n${section}\n${SPECTHREAD_END}`;

/**
 * 표식 없이 만들어진 이전 버전의 AGENTS.md 인지. scaffold 의 제목과 절 이름으로 본다.
 *
 * 섹션을 덧붙이면 같은 내용이 두 번 들어가고, 파일 전체를 바꾸면 사용자가 덧붙인 내용이
 * 사라질 수 있다. 그래서 건드리지 않고 알린다.
 */
const isLegacyAgents = (content: string): boolean =>
  /^# specthread\s*$/m.test(content) && /^## 2\. SDD 작업 흐름\s*$/m.test(content);

/** AGENTS.md 의 specthread 섹션을 맞춘다. 이전 버전 파일이라 손대지 않았으면 false */
const ensureAgentsMd = (cwd: string, scaffold: string): boolean => {
  const dest = join(cwd, "AGENTS.md");
  const section = readFileSync(join(scaffold, "AGENTS.md"), "utf8");

  if (!existsSync(dest)) {
    writeFileSync(dest, `${wrapSection(section)}\n`, "utf8");
    console.log("  AGENTS.md 생성");
    return true;
  }

  const content = readFileSync(dest, "utf8");
  if (content.includes(SPECTHREAD_START)) {
    const before = content.slice(0, content.indexOf(SPECTHREAD_START));
    const after = content.slice(
      content.indexOf(SPECTHREAD_END) + SPECTHREAD_END.length,
    );
    writeFileSync(dest, `${before}${wrapSection(section)}${after}`, "utf8");
    console.log("  AGENTS.md specthread 섹션 갱신");
    return true;
  }

  if (isLegacyAgents(content)) {
    console.log("  AGENTS.md 이전 버전 형식 (구분 표식 없음). 건드리지 않음");
    return false;
  }

  writeFileSync(dest, `${content.trimEnd()}\n\n${wrapSection(section)}\n`, "utf8");
  console.log("  AGENTS.md specthread 섹션 삽입");
  return true;
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

  writeFileSync(dest, `${content.trimEnd()}\n\n# specthread 개인 설정\n${LOCAL_CONFIG_PATH}\n`, "utf8");
  console.log(`  .gitignore ${LOCAL_CONFIG_PATH} 추가`);
};

const SKILLS = ["check", "gen", "plan-open", "plan-run", "plan-close"];

const parseTools =(args: string[]): Set<string> => {
  const idx = args.indexOf("--tools");
  if (idx === -1 || idx + 1 >= args.length) return new Set(["claude"]);
  return new Set(args[idx + 1].split(",").map((t) => t.trim().toLowerCase()));
};

const STATUS_LABEL = {
  created: "생성",
  overwritten: "덮어씀",
  skipped: "이미 존재. 건너뜀",
  kept: "사용자 파일. 건너뜀",
} as const;

const UPGRADE_GUIDE = "README 의 '0.1.x 에서 올리기'";

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

  const configStatus = putFile(join(cwd, CONFIG_PATH), renderConfig(DEFAULT_CONFIG), force, "user");
  console.log(`  ${CONFIG_PATH} ${STATUS_LABEL[configStatus]}`);

  // scaffold 원본은 고정 경로와 같은 파일 이름을 쓴다
  const docs: [string, Owner][] = [
    [RULES_PATH, "package"],
    [PROJECT_PATH, "user"],
    [PENDING_PATH, "user"],
  ];
  for (const [dest, owner] of docs) {
    const status = copyFile(join(scaffold, basename(dest)), join(cwd, dest), force, owner);
    console.log(`  ${dest} ${STATUS_LABEL[status]}`);
  }

  for (const file of ["spec.md", "plan.md"]) {
    const dest = `${TEMPLATES_DIR}/${file}`;
    const status = copyFile(join(scaffold, "templates", file), join(cwd, dest), force, "package");
    console.log(`  ${dest} ${STATUS_LABEL[status]}`);
  }

  let legacy = !ensureAgentsMd(cwd, scaffold);
  ensureGitignore(cwd);

  if (tools.has("claude")) {
    ensureClaudeMd(cwd);

    // Claude Code 는 `<이름>/SKILL.md` 만 스킬로 읽는다. 0.1.x 는 `<이름>.md` 로 깔았다
    const skillsDir = join(cwd, ".claude", "skills");
    const oldSkills: string[] = [];
    for (const name of SKILLS) {
      const status = copyFile(
        join(scaffold, "claude", "skills", name, "SKILL.md"),
        join(skillsDir, name, "SKILL.md"),
        force,
        "package",
      );
      console.log(`  .claude/skills/${name}/SKILL.md ${STATUS_LABEL[status]}`);
      if (existsSync(join(skillsDir, `${name}.md`))) oldSkills.push(`.claude/skills/${name}.md`);
    }

    // 사용자가 고쳤을 수 있으므로 지우지 않고 알리기만 한다
    if (oldSkills.length > 0) {
      legacy = true;
      console.log("\n  이전 형식의 스킬 파일이 남아 있다. Claude Code 가 읽지 않으므로 지워도 된다:");
      for (const path of oldSkills) console.log(`    ${path}`);
    }
  }

  if (force) {
    console.log(`\n--force 는 패키지 파일만 갱신한다. ${CONFIG_PATH}, ${PROJECT_PATH}, ${PENDING_PATH} 는 그대로 둔다.`);
  }
  if (legacy) {
    console.log(`\n이전 버전에서 올린 프로젝트로 보인다. 남은 정리는 ${UPGRADE_GUIDE} 를 따른다.`);
  }

  console.log("\n완료. npx specthread check 로 문서 정합성을 확인할 수 있다.");
};
