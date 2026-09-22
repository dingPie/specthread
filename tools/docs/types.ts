import type { RuleId } from './constants/rules.ts';
import type { SpecthreadConfig } from './config.schema.ts';

/** 색인 자료 구조. 검사기와 생성기가 공유한다. */

/**
 * 앵커가 붙은 링크의 라벨 구간과 그 링크 대상.
 *
 * 라벨 안에 놓인 `§N` 은 라벨 글자가 아니라 **링크 대상 경로** 로 풀어야 한다.
 * `` [`CLAUDE.md` §1](../../CLAUDE.md#1-절대-원칙) `` 에서 라벨만 보면 루트와 client
 * 중 어느 `CLAUDE.md` 인지 알 수 없지만 대상 경로는 알려준다.
 */
export interface AnchorLabelSpan { start: number; end: number; target: string }

/** 1-indexed, 양끝 포함 */
export interface Range { start: number; end: number }

/** 절 하나. 번호가 있는 것만 `§` 로 가리킬 수 있다 */
export interface Heading {
  level: number;
  /** 앞머리 번호. `6` / `6-1`. 번호 없는 헤딩은 null */
  num: string | null;
  /** 번호를 뗀 제목 */
  title: string;
  /** 번호를 포함한 원문 */
  raw: string;
  anchor: string;
  line: number;
  /** 꼬리 절 (참조 / 미확정 사항 / 변경 이력) 인지 */
  tail: boolean;
}

/** 마크다운 링크 하나. 절 귀속 정보가 있어야 참조 절을 생성할 수 있다 */
export interface Link {
  label: string;
  /** 링크 대상 경로. 앵커 전용 링크는 null */
  target: string | null;
  anchor: string | null;
  line: number;
  /** 이 링크가 놓인 절의 번호. 참조 절 생성에 쓴다 */
  section: string | null;
  /** 꼬리 절 안의 링크인지. 참조 절 생성에서 제외한다 */
  inTail: boolean;
}

/** `§N` 참조 하나. 해소 결과와 사유를 함께 담아 지적 메시지를 만든다 */
export interface SectionRef {
  /** 가리키는 절 번호 */
  num: string;
  /** 해소된 대상 문서의 리포 상대 경로. 미해소는 null */
  targetFile: string | null;
  /** 원문에 적힌 문서명. 자기 참조는 null */
  rawTarget: string | null;
  /** 미해소 사유 */
  reason: "resolved" | "no-doc-name" | "unknown-doc" | "ambiguous-doc";
  /**
   * 앵커 링크 안에 놓인 참조인지.
   *
   * 다른 문서의 절은 앵커 링크로 가리켜야 한다 (`docs/system/rules.md` §3-5).
   * 링크 없이 `§N` 만 적은 것을 가려내는 데 쓴다.
   */
  linked: boolean;
  line: number;
}

/** 미결 마커 하나 */
export interface Marker {
  kind: string;
  slug: string;
  line: number;
}

/** 큐 항목 또는 문서 미확정 사항 절 항목 */
export interface PendingItem {
  kind: string;
  slug: string;
  line: number;
}

/** 파일 종류. 뽑을 재료와 참조 해소 규칙이 달라진다 */
export type FileKind = "doc" | "source";

/** 색인된 파일 하나. 검사기와 생성기가 이 모양만 보고 일한다 */
export interface IndexedFile {
  /** 리포 루트 기준 상대 경로 */
  path: string;
  kind: FileKind;
  /**
   * 파일 전문. 검사기와 생성기가 다시 읽지 않게 색인이 들고 있는다.
   *
   * 각자 읽으면 같은 파일을 세 번 읽고, 서로 다른 내용을 볼 여지가 남는다.
   */
  lines: string[];
  headings: Heading[];
  links: Link[];
  sectionRefs: SectionRef[];
  markers: Marker[];
  pendingItems: PendingItem[];
  /** 목차 블록 위치. 생성기가 덮어쓴다 */
  tocBlock: Range | null;
  /** 하단 참조 절 본문 범위. 헤딩 줄은 뺀다 - 생성기가 절 제목을 지우면 안 된다 */
  refSection: Range | null;
  /** 미확정 사항 절 본문 범위. 헤딩 줄은 뺀다. 없는 문서도 많다 - 그 절 자체가 선택이다 */
  pendingSection: Range | null;
  /** 변경 이력 절 본문 범위. 이 안의 참조는 과거 상태를 적은 것이라 검사에서 뺀다 */
  changeLogRange: Range | null;
  /** 변경 이력 절의 날짜. 정렬 검사에 쓴다 */
  changeLogDates: string[];
  /** `@specthread-ignore` 로 억제된 줄 번호 (1-indexed) */
  ignored: Set<number>;
}

/** 색인 전체 */
export interface DocIndex {
  files: Map<string, IndexedFile>;
  /** 문서 basename·stem → 경로 목록. § 참조 해소에 쓴다 */
  docsByName: Map<string, string[]>;
  /** 로드된 설정. 검사기·생성기가 규약 경로 등에 접근할 때 쓴다 */
  config: SpecthreadConfig;
}

/** 지적 하나. `rule` 로 집계하고 `file`·`line` 으로 자리를 가리킨다 */
export interface Finding {
  file: string;
  line: number;
  rule: RuleId;
  message: string;
}
