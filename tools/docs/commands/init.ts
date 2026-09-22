import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SPECTHREAD_START = "<!-- specthread:start -->";
const SPECTHREAD_END = "<!-- specthread:end -->";

const scaffoldDir = (): string => {
  const thisFile = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(thisFile, "..", "..", "scaffold"),
    join(thisFile, "..", "scaffold"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  throw new Error("scaffold 디렉터리를 찾을 수 없다");
};

const copyFile = (
  src: string,
  dest: string,
  force: boolean,
): "created" | "overwritten" | "skipped" => {
  if (existsSync(dest) && !force) return "skipped";
  const existed = existsSync(dest);
  const dir = dirname(dest);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(dest, readFileSync(src, "utf8"), "utf8");
  return existed ? "overwritten" : "created";
};

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

const parseTools = (args: string[]): Set<string> => {
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

  const stDir = join(cwd, "specthread");
  if (existsSync(stDir)) {
    console.log("  specthread/ 이미 존재 - 기존 설정 유지");
  } else {
    mkdirSync(stDir, { recursive: true });
    console.log("  specthread/ 생성");
  }

  const specthreadFiles = [
    "config.jsonc",
    "rules.md",
    "project.md",
    "pending.md",
  ];
  for (const file of specthreadFiles) {
    const status = copyFile(join(scaffold, file), join(stDir, file), force);
    console.log(`  specthread/${file} ${STATUS_LABEL[status]}`);
  }

  const templateFiles = ["spec.md", "plan.md"];
  const templatesDir = join(stDir, "templates");
  for (const file of templateFiles) {
    const status = copyFile(
      join(scaffold, "templates", file),
      join(templatesDir, file),
      force,
    );
    console.log(`  specthread/templates/${file} ${STATUS_LABEL[status]}`);
  }

  ensureAgentsMd(cwd, scaffold);

  if (tools.has("claude")) {
    ensureClaudeMd(cwd);

    const skillsDir = join(cwd, ".claude", "skills");
    if (!existsSync(skillsDir)) mkdirSync(skillsDir, { recursive: true });

    const skillFiles = [
      "check.md",
      "gen.md",
      "plan-open.md",
      "plan-run.md",
      "plan-close.md",
    ];
    for (const file of skillFiles) {
      const status = copyFile(
        join(scaffold, "claude", "skills", file),
        join(skillsDir, file),
        force,
      );
      console.log(`  .claude/skills/${file} ${STATUS_LABEL[status]}`);
    }
  }

  console.log("\n완료. npx specthread check 로 문서 정합성을 확인할 수 있다.");
};
