import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SpecthreadConfig, SkipCheckEntry } from "./config.schema.ts";
import { DEFAULT_CONFIG } from "./config.schema.ts";
import { ALL_RULE_GROUPS } from "./constants/rules.ts";

const CONFIG_FILE = "specthread/config.jsonc";
const LOCAL_CONFIG_FILE = "specthread/config.local.jsonc";

// ---------------------------------------------------------------------------
// JSONC 파싱
// ---------------------------------------------------------------------------

const stripJsonComments = (text: string): string => {
  let result = "";
  let i = 0;
  let inString = false;
  let escapeNext = false;

  while (i < text.length) {
    const ch = text[i];

    if (escapeNext) {
      result += ch;
      escapeNext = false;
      i++;
      continue;
    }

    if (inString) {
      if (ch === "\\") escapeNext = true;
      if (ch === '"') inString = false;
      result += ch;
      i++;
      continue;
    }

    if (ch === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      continue;
    }

    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++;
      i += 2;
      continue;
    }

    if (ch === '"') inString = true;

    result += ch;
    i++;
  }

  return result;
};

const parseJsonc = (text: string): unknown =>
  JSON.parse(stripJsonComments(text));

// ---------------------------------------------------------------------------
// Deep merge — 중첩 객체만 재귀, 배열은 덮어쓰기
// ---------------------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const deepMerge = (
  base: Record<string, unknown>,
  override: Record<string, unknown>,
): Record<string, unknown> => {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overVal = override[key];

    if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      result[key] = deepMerge(baseVal, overVal);
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// skipCheck 검증
// ---------------------------------------------------------------------------

const ruleGroupSet = new Set<string>(ALL_RULE_GROUPS);

const validateSkipCheck = (
  items: (string | SkipCheckEntry)[],
): (string | SkipCheckEntry)[] => {
  for (const item of items) {
    if (typeof item === "string") continue;
    for (const group of item.only) {
      if (!ruleGroupSet.has(group)) {
        console.warn(
          `[specthread] skipCheck: unknown rule group "${group}" in path "${item.path}". ` +
          `Valid groups: ${ALL_RULE_GROUPS.join(", ")}`,
        );
      }
    }
  }
  return items;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const loadConfig = (cwd: string = process.cwd()): SpecthreadConfig => {
  let config: SpecthreadConfig = { ...DEFAULT_CONFIG };

  const configPath = join(cwd, CONFIG_FILE);
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    const parsed = parseJsonc(raw) as Partial<SpecthreadConfig>;
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      parsed as Record<string, unknown>,
    ) as unknown as SpecthreadConfig;
  }

  const localPath = join(cwd, LOCAL_CONFIG_FILE);
  if (existsSync(localPath)) {
    const raw = readFileSync(localPath, "utf-8");
    const parsed = parseJsonc(raw) as Partial<SpecthreadConfig>;
    config = deepMerge(
      config as unknown as Record<string, unknown>,
      parsed as Record<string, unknown>,
    ) as unknown as SpecthreadConfig;
  }

  config.skipCheck = validateSkipCheck(config.skipCheck);

  return config;
};
