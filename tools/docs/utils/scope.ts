/**
 * 대상 판정 - 무엇을 검사·생성 대상으로 볼지.
 *
 * 변경 이력 절은 과거 상태를 적은 곳이다. 지워진 문서를 가리키는 것이 정상이므로
 * 링크·절 참조 검사에서 뺀다. 지키게 하면 이력을 고쳐 써야 하는데, 그건
 * `specthread/rules.md` §2-4 가 이력에 사건 기록을 남기라고 한 것과 어긋난다.
 * 참조 절과 미확정 사항 절은 현재 상태라 검사한다.
 */
import type { SpecthreadConfig } from "../config.schema.ts";
import { TAIL_NAMES } from "../constants/docs.ts";
import { DEFAULT_EXCLUDES } from "../constants/paths.ts";
import type { RuleGroup, RuleId } from "../constants/rules.ts";
import type { Finding, Heading, IndexedFile, Range } from "../types.ts";
import { underPath } from "./path-match.ts";

const inRange = (range: Range | null, line: number): boolean =>
  range !== null && line >= range.start && line <= range.end;

/** 변경 이력 절 안의 줄인지 */
export const inChangeLog = (file: IndexedFile, line: number): boolean =>
  inRange(file.changeLogRange, line);

/**
 * 목차 블록 안의 줄인지.
 *
 * 목차는 헤딩을 복사해 기계가 만든다. 제목에 `§` 가 들어 있으면 목차에도 실려
 * 같은 지적이 두 번 나온다. 생성물은 원본만 검사한다.
 */
export const inToc = (file: IndexedFile, line: number): boolean => inRange(file.tocBlock, line);

/**
 * 참조 절 안의 줄인지.
 *
 * 참조 절의 줄 끝 `§N` 은 **이 문서의 어느 절에서 가리켰는지** 를 적은 역링크라,
 * 같은 줄 왼쪽 문서명을 대상으로 삼는 해소 규칙과 방향이 반대다. 그대로 두면
 * 기계 생성물이 스스로 깨진 참조로 잡힌다.
 */
export const inRefSection = (file: IndexedFile, line: number): boolean =>
  inRange(file.refSection, line);

/**
 * 미확정 사항 절 안의 줄인지.
 *
 * 관리 문서 항목의 제목을 옮겨 온 생성 뷰다. 제목 안의 링크·절 참조·날짜는 관리 문서 기준으로
 * 적힌 것이라, 이 문서 기준으로 검사하면 이 문서에서는 고칠 수 없는 지적이 된다. 원문은
 * 관리 문서에서 검사한다.
 */
export const inPendingSection = (file: IndexedFile, line: number): boolean =>
  inRange(file.pendingSection, line);

/**
 * 헤딩 줄인지.
 *
 * 제목 안 `§` 는 이름의 일부이지 참조가 아니다. 제목에 마일스톤 라벨을 넣은 것은
 * 규칙 1 위반이라 그 규칙을 보는 검사가 따로 잡아야 한다.
 */
export const isHeadingLine = (file: IndexedFile, line: number): boolean =>
  file.headings.some((h) => h.line === line);

/** 마크다운 문서인지. 헤딩·목차·꼬리 절을 갖는 것은 문서뿐이다 */
export const isDoc = (file: IndexedFile): boolean => file.kind === "doc";

/** 작업 문서인지. 흡수 후 사라지므로 미확정 사항 절을 만들지 않는다 */
export const isWorkDoc = (path: string, config: SpecthreadConfig): boolean =>
  underPath(path, config.work);

/** 참조 절을 생성·검사할 문서인지. skipRefs 경로 아래의 문서는 제외한다 */
export const wantsRefSection = (file: IndexedFile, config: SpecthreadConfig): boolean =>
  isDoc(file) && !config.skipRefs.some((base) => underPath(file.path, base));

/** 문서 제목 헤딩 목록. 하나여야 정상이다 */
export const titleHeadings = (file: IndexedFile): Heading[] =>
  file.headings.filter((h) => h.level === 1);

/** 문서 제목의 헤딩. 하나가 아니면 null */
export const singleTitle = (file: IndexedFile): Heading | null => {
  const titles = titleHeadings(file);
  return titles.length === 1 ? titles[0] : null;
};

/**
 * 꼬리 절이 참조 → 미확정 사항 → 변경 이력 순서인지. 없는 절은 건너뛴다.
 *
 * 생성기는 원본 줄 번호로 범위를 교체하며 이 순서를 전제한다.
 */
export const tailOrderOk = (headings: Heading[]): boolean => {
  const order = headings
    .filter((h) => h.level === 2 && h.tail)
    .map((h) => TAIL_NAMES.indexOf(h.title as (typeof TAIL_NAMES)[number]));
  return order.every((n, i) => i === 0 || n > order[i - 1]);
};

/** 규칙 id 의 군 */
export const groupOf = (rule: RuleId): RuleGroup => rule.split("/")[0] as RuleGroup;

/**
 * 이 파일에서 유지할 규칙군. null 이면 전부, 빈 집합이면 하나도 없음.
 *
 * skipCheck 문자열 항목은 `{ path, only: [] }` 와 같다. 기본 제외가 앞에 붙는다.
 * 여러 항목이 걸리면 모두 허용하는 군만 남는다.
 */
export const allowedGroups = (path: string, config: SpecthreadConfig): Set<RuleGroup> | null => {
  let allowed: Set<RuleGroup> | null = null;
  for (const entry of [...DEFAULT_EXCLUDES, ...config.skipCheck]) {
    const base = typeof entry === "string" ? entry : entry.path;
    if (!underPath(path, base)) continue;
    const only = typeof entry === "string" ? [] : entry.only;
    allowed = allowed === null ? new Set(only) : new Set(only.filter((g) => allowed?.has(g)));
  }
  return allowed;
};

/** 이 파일에서 이 군을 검사·생성하는지 */
export const groupAllowed = (path: string, group: RuleGroup, config: SpecthreadConfig): boolean => {
  const allowed = allowedGroups(path, config);
  return allowed === null || allowed.has(group);
};

/**
 * skipCheck 에 걸려 버릴 지적인지.
 *
 * 지적이 달린 파일 기준으로 판정한다. 색인 단계에서 파일을 빼면 그 파일을 가리키는 링크·절
 * 참조와 마커 집계가 함께 사라진다.
 */
export const isSkipped = (finding: Finding, config: SpecthreadConfig): boolean =>
  !groupAllowed(finding.file, groupOf(finding.rule), config);
