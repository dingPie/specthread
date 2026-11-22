/**
 * 업데이트 단계를 만드는 데 쓰는 상태와 단계 형식.
 */
import type { ConfigKey } from "../../config-loader.ts";
import type { SpecthreadConfig } from "../../config.schema.ts";

/** AGENTS.md 처리 결과. `legacy`·`broken` 은 파일을 고치지 않은 경우다 */
export type AgentsStatus = "written" | "legacy" | "broken";

/** init 이 실행하며 알게 된 상태와 프로젝트에서 읽은 설정 */
export interface UpgradeContext {
  root: string;
  config: SpecthreadConfig;
  /** 설정 파일에 있지만 스키마에 없는 키 */
  unknownKeys: ConfigKey[];
  agents: AgentsStatus;
  /** 내용이 바뀐 패키지 파일 */
  overwritten: string[];
  /** init 이 설치하는 스킬 이름. claude 를 고르지 않았으면 비어 있다 */
  skills: string[];
}

/** 단계 하나. 첫 줄이 지시이고 나머지 줄은 그 아래 들여 쓴다 */
export type Step = string[];

/** 사용자 파일에 남은 옛 scaffold 문구. `after` 는 지금 scaffold 의 문구다 */
export interface StaleText {
  file: string;
  before: string;
  after: string;
}

/** 한 버전에서 바뀐 것을 기존 프로젝트에 반영하는 단계 */
export interface VersionUpgrade {
  version: string;
  steps: (ctx: UpgradeContext) => Step[];
  staleText: StaleText[];
}

export const bullets = (items: string[]): string[] =>
  items.map((item) => `- ${item}`);
