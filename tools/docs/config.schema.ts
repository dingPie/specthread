/**
 * specthread.config.jsonc 스키마.
 *
 * 파싱: strip-json-comments 로 주석 제거 후 JSON.parse().
 */
import type { RuleGroup } from "./constants/rules.ts";

// ---------------------------------------------------------------------------
// 스캔 대상
// ---------------------------------------------------------------------------

/**
 * 프로젝트 경로. 자유 KV — 키는 용도 라벨, 값은 경로 배열.
 * 디렉터리면 재귀 스캔, 파일이면 직접 로드. 파싱 전략은 확장자로 결정.
 *
 * 예:
 *   "docs": ["docs/"]                          — docs-only 프로젝트
 *   "source": ["client/src/"], "data": ["data/"] — 소스+데이터
 *   "meta": ["CLAUDE.md", "AGENTS.md"]          — 루트의 개별 파일
 */
export type PathConfig = Record<string, string[]>;

// ---------------------------------------------------------------------------
// 기능 플래그
// ---------------------------------------------------------------------------

/**
 * 기능 단위 on/off. tsconfig 의 strict/noImplicitAny 모델.
 *
 * 28 개 규칙은 독립적이지 않다 (heading 이 깨지면 section-ref 가 깨짐).
 * 개별 레벨이 아닌 기능 플래그로 묶는다.
 */
export interface FeaturesConfig {
  /** 마커 체계 전체. false → marker/*, pending/* 검사 + pending 추적 비활성화 */
  markers: boolean;
  /** em dash 검사 + 치환 훅. false → style/em-dash 검사 + hook 비활성화 */
  emDash: boolean;
  /** 참조 절 자동 생성. false → reference/* 검사 + gen references 스킵 */
  references: boolean;
}

// ---------------------------------------------------------------------------
// 마커 체계
// ---------------------------------------------------------------------------

export interface MarkersConfig {
  /**
   * 마커 종류. "system" 은 코어 예약, 나머지는 프로젝트 정의.
   * 예: ["system", "design", "balance", "deps", "style"]
   */
  types: string[];
  /**
   * 처리 시점 라벨. 마일스톤 등.
   * 예: ["M1", "M2", "M3"]
   */
  timepoints: string[];
}

// ---------------------------------------------------------------------------
// 문서 유형
// ---------------------------------------------------------------------------

export interface FrontmatterSchema {
  required: string[];
  optional: string[];
}

export interface DocTypeConfig {
  path: string;
  template: string;
  frontmatter?: FrontmatterSchema;
}

// ---------------------------------------------------------------------------
// 검사 제어
// ---------------------------------------------------------------------------

/**
 * skipCheck 항목의 객체 형태.
 * path 에 매칭되는 파일에 대해 only 에 지정한 군만 검사한다.
 */
export interface SkipCheckEntry {
  path: string;
  only: RuleGroup[];
}

// ---------------------------------------------------------------------------
// i18n (후순위)
// ---------------------------------------------------------------------------

/**
 * 현재 한국어 고정. 다국어 필요 시 locale 별 문자열 맵으로 확장.
 *
 * 한국어 의존: TAIL_NAMES, TIMEPOINT 정규식, SENTENCE_END,
 * 출력 메시지, 참조 절 제목, 요약 표 헤더.
 */
export type Locale = "ko";

// ---------------------------------------------------------------------------
// 루트 설정
// ---------------------------------------------------------------------------

export interface SpecthreadConfig {
  /** 스캔 대상 경로. 자유 KV */
  path: PathConfig;

  features: FeaturesConfig;
  markers: MarkersConfig;
  docTypes: Record<string, DocTypeConfig>;

  /**
   * 문서명 해소 시 무시할 단어.
   * 예: ["spec"] — "spec §4" 가 template/spec.md 로 잘못 매칭되는 것 방지.
   */
  ignoreDocNames: string[];

  /**
   * 규칙 검사를 건너뛸 경로.
   * - string: 해당 경로 prefix 의 전체 검사를 건너뛴다
   * - { path, only }: 해당 경로에서 지정한 군만 검사한다
   */
  skipCheck: (string | SkipCheckEntry)[];
  /** 참조 절 생성을 건너뛸 경로 */
  skipRefs: string[];

  locale: Locale;

  // ── 규약 경로 ──────────────────────────────────────
  // 도구가 직접 읽고/쓰는 파일. path 와 별개.
  // config.jsonc 에서 생략하면 DEFAULT_CONFIG 값이 쓰인다.

  /** 규칙 문서 */
  rules: string;
  /** 미확정 사항 정본 */
  pending: string;
  /** 프로젝트 맥락 문서 */
  project: string;
  /** 초안 문서 폴더 */
  work: string;
}

// ---------------------------------------------------------------------------
// 기본값
// ---------------------------------------------------------------------------

export const DEFAULT_CONFIG: SpecthreadConfig = {
  path: {
    docs: ["docs/"],
    specthread: ["specthread/"],
  },
  features: {
    markers: true,
    emDash: true,
    references: true,
  },
  markers: {
    types: ["system"],
    timepoints: [],
  },
  docTypes: {},
  ignoreDocNames: [],
  skipCheck: [],
  skipRefs: [],
  locale: "ko",

  rules: "specthread/rules.md",
  pending: "specthread/pending.md",
  project: "specthread/project.md",
  work: "docs/work/",
};
