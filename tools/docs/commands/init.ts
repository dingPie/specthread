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

type WriteStatus = "created" | "overwritten" | "skipped";

const putFile = (dest: string, content: string, force: boolean): WriteStatus => {
  if (existsSync(dest) && !force) return "skipped";
  const existed = existsSync(dest);
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(dest, content, "utf8");
  return existed ? "overwritten" : "created";
};

const copyFile = (src: string, dest: string, force: boolean): WriteStatus =>
  putFile(dest, readFileSync(src, "utf8"), force);

const ensureAgentsMd = (cwd: string, scaffold: string): void => {
  const dest = join(cwd, "AGENTS.md");
  const src = join(scaffold, "AGENTS.md");

  if (!existsSync(dest)) {
    writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
    console.log("  AGENTS.md 생성");
    return;
  }

  const content = readFileSync(dest, "utf8");
  if (content.includes(SPECTHREAD_START)) {
    const before = content.slice(0, content.indexOf(SPECTHREAD_START));
    const after = content.slice(
      content.indexOf(SPECTHREAD_END) + SPECTHREAD_END.length,
    );
    const section = readFileSync(src, "utf8");
    writeFileSync(
      dest,
      `${before}${SPECTHREAD_START}\n${section}\n${SPECTHREAD_END}${after}`,
      "utf8",
    );
    console.log("  AGENTS.md specthread 섹션 갱신");
    return;
  }

  const section = readFileSync(src, "utf8");
  writeFileSync(
    dest,
    `${content.trimEnd()}\n\n${SPECTHREAD_START}\n${section}\n${SPECTHREAD_END}\n`,
    "utf8",
  );
  console.log("  AGENTS.md specthread 섹션 삽입");
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

  const configStatus = putFile(join(cwd, CONFIG_PATH), renderConfig(DEFAULT_CONFIG), force);
  console.log(`  ${CONFIG_PATH} ${STATUS_LABEL[configStatus]}`);

  // scaffold 원본은 고정 경로와 같은 파일 이름을 쓴다
  for (const dest of [RULES_PATH, PROJECT_PATH, PENDING_PATH]) {
    const status = copyFile(join(scaffold, basename(dest)), join(cwd, dest), force);
    console.log(`  ${dest} ${STATUS_LABEL[status]}`);
  }

  for (const file of ["spec.md", "plan.md"]) {
    const dest = `${TEMPLATES_DIR}/${file}`;
    const status = copyFile(join(scaffold, "templates", file), join(cwd, dest), force);
    console.log(`  ${dest} ${STATUS_LABEL[status]}`);
  }

  ensureAgentsMd(cwd, scaffold);
  ensureGitignore(cwd);

  if (tools.has("claude")) {
    ensureClaudeMd(cwd);

    // Claude Code 는 `<이름>/SKILL.md` 만 스킬로 읽는다. 0.1.x 는 `<이름>.md` 로 깔았다
    const skillsDir = join(cwd, ".claude", "skills");
    const legacy: string[] = [];
    for (const name of SKILLS) {
      const status = copyFile(
        join(scaffold, "claude", "skills", name, "SKILL.md"),
        join(skillsDir, name, "SKILL.md"),
        force,
      );
      console.log(`  .claude/skills/${name}/SKILL.md ${STATUS_LABEL[status]}`);
      if (existsSync(join(skillsDir, `${name}.md`))) legacy.push(`.claude/skills/${name}.md`);
    }

    // 사용자가 고쳤을 수 있으므로 지우지 않고 알리기만 한다
    if (legacy.length > 0) {
      console.log("\n  이전 형식의 스킬 파일이 남아 있다. Claude Code 가 읽지 않으므로 지워도 된다:");
      for (const path of legacy) console.log(`    ${path}`);
    }
  }

  console.log("\n완료. npx specthread check 로 문서 정합성을 확인할 수 있다.");
};
