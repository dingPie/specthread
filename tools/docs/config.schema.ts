/**
 * specthread/config.jsonc 스키마.
 *
 * 파싱과 검증은 `config-loader.ts` 가 한다. 규약 파일의 위치는 설정이 아니라
 * `constants/paths.ts` 가 갖는다.
 */
import type { RuleGroup } from "./constants/rules.ts";

// ---------------------------------------------------------------------------
// 파일 종류
// ---------------------------------------------------------------------------

/**
 * 파일 종류별 확장자 매핑.
 *
 * - `doc`: 기획 소스. 풀파싱 대상 (헤딩, 링크, 목차, 참조절, 변경이력, 마커).
 * - `source`: 문서 외 참조 파일. 마커 + 절참조 스캔만.
 *
 * JSON 전용 `"_pending"` 키 패턴은 확장자로 내부 자동 분기.
 */
export interface FileKindsConfig {
  doc: string[];
  source: string[];
}

// ---------------------------------------------------------------------------
// 스캔 대상
// ---------------------------------------------------------------------------

/**
 * 프로젝트 경로. 자유 KV - 키는 용도 라벨, 값은 경로 배열.
 * 디렉터리면 재귀 스캔, 파일이면 직접 로드. 파싱 전략은 확장자로 결정.
 *
 * 병합 시 객체 전체를 교체한다. 키 단위로 병합하면 기본 키를 생략으로 지울 수 없다.
 * 규약 파일 (`constants/paths.ts`) 은 여기 적지 않아도 항상 색인한다.
 *
 * 예:
 *   "docs": ["docs/"]                          - docs-only 프로젝트
 *   "source": ["client/src/"], "data": ["data/"] - 소스+데이터
 *   "meta": ["CLAUDE.md", "AGENTS.md"]          - 루트의 개별 파일
 */
export type PathConfig = Record<string, string[]>;

// ---------------------------------------------------------------------------
// 기능 플래그
// ---------------------------------------------------------------------------

/**
 * 기능 단위 on/off. tsconfig 의 strict/noImplicitAny 모델.
 *
 * 규칙은 독립적이지 않다 (heading 이 깨지면 section-ref 가 깨짐).
 * 개별 레벨이 아닌 기능 플래그로 묶는다.
 */
export interface FeaturesConfig {
  /** 마커 체계 전체. false → marker/*, pending/* 검사 + pending 추적 비활성화 */
  markers: boolean;
  /** 참조 절 자동 생성. false → reference/* 검사 + gen references 스킵 */
  references: boolean;
}

// ---------------------------------------------------------------------------
// 마커 체계
// ---------------------------------------------------------------------------

export interface MarkersConfig {
  /**
   * 마커 종류. "system" 은 코어 예약, 나머지는 프로젝트 정의.
   * 마커와 관리 문서 항목의 종류가 여기 없으면 `marker/unknown-type`.
   * 예: ["system", "design", "balance", "deps", "style"]
   */
  types: string[];
  /**
   * 처리 시점 라벨. 마일스톤 등.
   * 비어 있지 않으면 `해결 예정` 라벨이 여기 없을 때 `pending/unknown-timepoint`.
   * 비어 있으면 라벨을 검사하지 않는다.
   * 예: ["M1", "M2", "M3"]
   */
  timepoints: string[];
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
// 루트 설정
// ---------------------------------------------------------------------------

export interface SpecthreadConfig {
  /** 스캔 대상 경로. 자유 KV */
  path: PathConfig;

  /** 파일 종류별 확장자 매핑 */
  fileKinds: FileKindsConfig;

  features: FeaturesConfig;
  markers: MarkersConfig;

  /**
   * 문서명 해소 시 무시할 단어.
   * 예: ["spec"] - "spec §4" 가 templates/spec.md 로 잘못 매칭되는 것 방지.
   */
  ignoreDocNames: string[];

  /**
   * 규칙 검사를 건너뛸 경로. 경로 아래 (디렉터리 경계) 의 파일에 적용한다.
   * - string: 해당 경로의 검사·생성을 전부 건너뛴다
   * - { path, only }: 해당 경로에서 지정한 군만 검사·생성한다
   */
  skipCheck: (string | SkipCheckEntry)[];
  /** 참조 절을 만들지 않을 경로. 경로 아래 (디렉터리 경계) 의 문서에 적용한다 */
  skipRefs: string[];

  /** 작업 문서 폴더. 흡수 후 사라지므로 미확정 사항 절 생성·검사에서 뺀다 */
  work: string;
}

// ---------------------------------------------------------------------------
// 기본값
// ---------------------------------------------------------------------------

export const DEFAULT_FILE_KINDS: FileKindsConfig = {
  doc: [".md"],
  source: [
    ".js",
    ".jsx",
    ".mjs",
    ".ts",
    ".tsx",
    ".mts",
    ".py",
    ".java",
    ".kt",
    ".c",
    ".h",
    ".cpp",
    ".cs",
    ".go",
    ".rs",
    ".swift",
    ".php",
    ".rb",
    ".dart",
    ".lua",
    ".sh",
    ".json",
    ".jsonc",
    ".yaml",
    ".yml",
    ".toml",
    ".xml",
    ".html",
    ".css",
    ".scss",
    ".sql",
    ".graphql",
  ],
};

export const DEFAULT_CONFIG: SpecthreadConfig = {
  path: {
    docs: ["docs/"],
    specthread: ["specthread/"],
  },
  fileKinds: DEFAULT_FILE_KINDS,
  features: {
    markers: true,
    references: true,
  },
  markers: {
    types: ["system"],
    timepoints: [],
  },
  ignoreDocNames: [],
  skipCheck: [],
  skipRefs: [],
  work: "docs/work",
};
