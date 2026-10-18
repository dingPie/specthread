import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { SpecthreadConfig, SkipCheckEntry } from "./config.schema.ts";
import { DEFAULT_CONFIG } from "./config.schema.ts";
import { CONFIG_PATH, LOCAL_CONFIG_PATH } from "./constants/paths.ts";
import { ALL_RULE_GROUPS } from "./constants/rules.ts";
import { normalizeConfigPath } from "./utils/path-match.ts";

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

    // 블록 주석 안의 줄바꿈은 남긴다. 지우면 문법 오류의 줄 번호가 실제 파일과 어긋난다
    if (ch === "/" && text[i + 1] === "*") {
      i += 2;
      while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) {
        if (text[i] === "\n") result += "\n";
        i++;
      }
      i += 2;
      continue;
    }

    if (ch === '"') inString = true;

    result += ch;
    i++;
  }

  return result;
};

/**
 * 닫는 괄호 앞 쉼표를 지운다. 주석을 지운 뒤에 돌린다.
 *
 * JSONC 는 trailing comma 를 허용하고, Prettier 도 .jsonc 를 저장할 때 기본으로 넣는다.
 * 이걸 막으면 포맷만 해도 설정 파일을 읽지 못한다.
 */
const stripTrailingCommas = (text: string): string => {
  let result = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escapeNext) {
      escapeNext = false;
    } else if (inString) {
      if (ch === "\\") escapeNext = true;
      if (ch === '"') inString = false;
    } else if (ch === '"') {
      inString = true;
    } else if (ch === ",") {
      let j = i + 1;
      while (j < text.length && /\s/.test(text[j])) j++;
      if (text[j] === "}" || text[j] === "]") continue;
    }

    result += ch;
  }

  return result;
};

// ---------------------------------------------------------------------------
// 오류
// ---------------------------------------------------------------------------

/** 설정을 읽지 못한 이유 하나. 어느 파일 어느 키인지 함께 낸다 */
export interface ConfigProblem {
  file: string;
  /** 점으로 이은 키 경로. 파일 전체의 문제면 빈 문자열 */
  key: string;
  message: string;
}

/**
 * 설정을 쓸 수 없을 때 던진다.
 *
 * 문제를 하나씩 던지면 사용자가 고치고 다시 돌리기를 반복해야 한다. 한 번에 모아 낸다.
 */
export class ConfigError extends Error {
  readonly problems: ConfigProblem[];

  constructor(problems: ConfigProblem[]) {
    super(problems.map((p) => `${p.file}${p.key === "" ? "" : ` ${p.key}`}: ${p.message}`).join("\n"));
    this.problems = problems;
  }
}

const parseJsonc = (text: string, file: string): unknown => {
  try {
    return JSON.parse(stripTrailingCommas(stripJsonComments(text)));
  } catch (e) {
    throw new ConfigError([{ file, key: "", message: `JSONC 문법 오류 - ${(e as Error).message}` }]);
  }
};

// ---------------------------------------------------------------------------
// 검증
// ---------------------------------------------------------------------------

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);

const isStringArray = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === "string");

/** 값 하나를 본다. 맞으면 null, 틀리면 사유 */
type Check = (v: unknown) => string | null;

const stringArray: Check = (v) => (isStringArray(v) ? null : "문자열 배열이어야 한다");
const string: Check = (v) => (typeof v === "string" ? null : "문자열이어야 한다");
// 문자열 "false" 는 참으로 읽히므로 받지 않는다
const bool: Check = (v) => (typeof v === "boolean" ? null : "true 또는 false 여야 한다 (따옴표 없이)");
const skipCheckList: Check = (v) => {
  if (!Array.isArray(v)) return "배열이어야 한다";
  const ok = v.every(
    (e) => typeof e === "string" || (isPlainObject(e) && typeof e.path === "string" && isStringArray(e.only)),
  );
  return ok ? null : '항목은 경로 문자열이거나 { "path": 문자열, "only": 문자열 배열 } 이어야 한다';
};

/** 키 하나의 모양. 값을 직접 보거나, 하위 키를 갖거나, 임의 키의 값을 본다 */
interface Field {
  check?: Check;
  fields?: Record<string, Field>;
  anyKey?: Check;
}

const SCHEMA: Record<string, Field> = {
  path: { anyKey: stringArray },
  fileKinds: { fields: { doc: { check: stringArray }, source: { check: stringArray } } },
  features: { fields: { markers: { check: bool }, references: { check: bool } } },
  markers: { fields: { types: { check: stringArray }, timepoints: { check: stringArray } } },
  ignoreDocNames: { check: stringArray },
  skipCheck: { check: skipCheckList },
  skipRefs: { check: stringArray },
  work: { check: string },
};

/** 제거한 키. 기존 config 가 깨지지 않게 오류 대신 경고로 알린다 */
const REMOVED_KEYS: Record<string, string> = {
  locale: "읽는 곳이 없었다",
  rules: `규칙 문서는 specthread/rules.md 고정이다`,
  pending: `관리 문서는 specthread/pending.md 고정이다`,
  project: `프로젝트 문서는 specthread/project.md 고정이다`,
  "features.emDash": "em dash 검사를 제거했다",
};

interface Validated {
  value: Record<string, unknown>;
  problems: ConfigProblem[];
  warnings: string[];
}

/**
 * 한 계층을 검증하고, 제거한 키와 모르는 키를 뺀 사본을 돌려준다.
 *
 * 병합 전에 계층마다 본다. 병합 뒤에 보면 틀린 값이 어느 파일에서 왔는지 알 수 없다.
 */
const validateLayer = (raw: unknown, file: string): Validated => {
  const problems: ConfigProblem[] = [];
  const warnings: string[] = [];

  if (!isPlainObject(raw)) {
    return { value: {}, problems: [{ file, key: "", message: "최상위가 객체여야 한다" }], warnings };
  }

  const walk = (obj: Record<string, unknown>, schema: Record<string, Field>, prefix: string) => {
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(obj)) {
      const full = prefix === "" ? key : `${prefix}.${key}`;
      if (full in REMOVED_KEYS) {
        warnings.push(`${file}: ${full} 는 제거된 키다. 지워도 된다 - ${REMOVED_KEYS[full]}`);
        continue;
      }
      const field = schema[key];
      if (field === undefined) {
        warnings.push(`${file}: 알 수 없는 키 ${full} - 무시한다`);
        continue;
      }
      if (field.check !== undefined) {
        const message = field.check(v);
        if (message === null) out[key] = v;
        else problems.push({ file, key: full, message });
        continue;
      }
      if (!isPlainObject(v)) {
        problems.push({ file, key: full, message: "객체여야 한다" });
        continue;
      }
      if (field.anyKey !== undefined) {
        const check = field.anyKey;
        const bad = Object.entries(v).filter(([, x]) => check(x) !== null);
        for (const [k, x] of bad) problems.push({ file, key: `${full}.${k}`, message: check(x) ?? "" });
        if (bad.length === 0) out[key] = v;
        continue;
      }
      out[key] = walk(v, field.fields ?? {}, full);
    }
    return out;
  };

  return { value: walk(raw, SCHEMA, ""), problems, warnings };
};

// ---------------------------------------------------------------------------
// Deep merge - 중첩 객체만 재귀, 배열은 덮어쓰기
// ---------------------------------------------------------------------------

/**
 * 객체지만 통째로 교체하는 키.
 *
 * `path` 는 키가 자유 라벨이라, 키 단위로 병합하면 기본 키 (`docs`, `specthread`) 를
 * 생략으로는 지울 수 없다. "이 경로들을 스캔한다" 는 뜻이 되려면 배열처럼 교체해야 한다.
 */
const REPLACE_KEYS = new Set(["path"]);

const deepMerge = (
  base: Record<string, unknown>,
  override: Record<string, unknown>,
  depth = 0,
): Record<string, unknown> => {
  const result = { ...base };

  for (const key of Object.keys(override)) {
    const baseVal = result[key];
    const overVal = override[key];

    if (depth === 0 && REPLACE_KEYS.has(key)) {
      result[key] = overVal;
    } else if (isPlainObject(baseVal) && isPlainObject(overVal)) {
      result[key] = deepMerge(baseVal, overVal, depth + 1);
    } else if (overVal !== undefined) {
      result[key] = overVal;
    }
  }

  return result;
};

// ---------------------------------------------------------------------------
// 병합 후 처리
// ---------------------------------------------------------------------------

const ruleGroupSet = new Set<string>(ALL_RULE_GROUPS);

/** 모르는 군은 경고만 한다. 그 군의 지적은 어차피 없으므로 걸러도 결과가 같다 */
const warnSkipCheckGroups = (items: (string | SkipCheckEntry)[]): void => {
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
};

/** 경로 값을 색인 경로와 같은 형태로 맞춘다. 소비처는 정규화된 값만 본다 */
const normalizePaths = (config: SpecthreadConfig): SpecthreadConfig => ({
  ...config,
  skipCheck: config.skipCheck.map((e) =>
    typeof e === "string" ? normalizeConfigPath(e) : { ...e, path: normalizeConfigPath(e.path) },
  ),
  skipRefs: config.skipRefs.map(normalizeConfigPath),
  work: normalizeConfigPath(config.work),
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * 기본값 → config.jsonc → config.local.jsonc 순으로 병합한 설정.
 *
 * 쓸 수 없는 값이 하나라도 있으면 `ConfigError` 를 던진다. 경고는 출력만 하고 진행한다.
 */
export const loadConfig = (root: string = process.cwd()): SpecthreadConfig => {
  let merged = { ...DEFAULT_CONFIG } as unknown as Record<string, unknown>;
  const problems: ConfigProblem[] = [];
  const warnings: string[] = [];

  for (const file of [CONFIG_PATH, LOCAL_CONFIG_PATH]) {
    const abs = join(root, file);
    if (!existsSync(abs)) continue;
    const layer = validateLayer(parseJsonc(readFileSync(abs, "utf-8"), file), file);
    problems.push(...layer.problems);
    warnings.push(...layer.warnings);
    merged = deepMerge(merged, layer.value);
  }

  for (const w of warnings) console.warn(`[specthread] ${w}`);
  if (problems.length > 0) throw new ConfigError(problems);

  const config = normalizePaths(merged as unknown as SpecthreadConfig);
  warnSkipCheckGroups(config.skipCheck);
  return config;
};
