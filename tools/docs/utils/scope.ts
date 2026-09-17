/**
 * 대상 판정 - 무엇을 검사·생성 대상으로 볼지.
 *
 * 변경 이력 절은 과거 상태를 적은 곳이다. 지워진 문서를 가리키는 것이 정상이므로
 * 링크·절 참조 검사에서 뺀다. 지키게 하면 이력을 고쳐 써야 하는데, 그건
 * [`docs/system/rules.md`](../../docs/system/rules.md) §2-1 이 이력에 사건 기록을
 * 남기라고 한 것과 어긋난다. 참조 절과 미확정 사항 절은 현재 상태라 검사한다.
 */
import type { SpecthreadConfig } from "../config.schema.ts";
import type { Finding, Heading, IndexedFile } from "../types.ts";

/** 변경 이력 절 안의 줄인지 */
export const inChangeLog = (file: IndexedFile, line: number): boolean =>
  file.changeLogRange !== null &&
  line >= file.changeLogRange.start &&
  line <= file.changeLogRange.end;


/** 규칙을 적용할 파일인지. skipCheck 의 string 항목(경로 접두사)에 걸리면 제외 */
export const isCheckTarget = (path: string, config: SpecthreadConfig): boolean =>
  !config.skipCheck.some((entry) => typeof entry === "string" && path.startsWith(entry));

/**
 * 목차 블록 안의 줄인지.
 *
 * 목차는 헤딩을 복사해 기계가 만든다. 제목에 `§` 가 들어 있으면 목차에도 실려
 * 같은 지적이 두 번 나온다. 생성물은 원본만 검사한다.
 */
export const inToc = (file: IndexedFile, line: number): boolean =>
  file.tocBlock !== null && line >= file.tocBlock.start && line <= file.tocBlock.end;

/**
 * 참조 절 안의 줄인지.
 *
 * 참조 절의 줄 끝 `§N` 은 **이 문서의 어느 절에서 가리켰는지** 를 적은 역링크라,
 * 같은 줄 왼쪽 문서명을 대상으로 삼는 해소 규칙과 방향이 반대다. 그대로 두면
 * 기계 생성물이 스스로 깨진 참조로 잡힌다.
 */
export const inRefSection = (file: IndexedFile, line: number): boolean =>
  file.refSection !== null &&
  line >= file.refSection.start &&
  line <= file.refSection.end;

/**
 * 헤딩 줄인지.
 *
 * 제목 안 `§` 는 이름의 일부이지 참조가 아니다. 제목에 마일스톤 라벨을 넣은 것은
 * 규칙 1 위반이라 그 규칙을 보는 검사가 따로 잡아야 한다.
 */
export const isHeadingLine = (file: IndexedFile, line: number): boolean =>
  file.headings.some((h) => h.line === line);

/** 규칙을 적용할 마크다운 문서인지. 검사기와 생성기가 같은 기준으로 걸러야 한다 */
export const isTargetDoc = (file: IndexedFile, config: SpecthreadConfig): boolean =>
  file.kind === 'md' && isCheckTarget(file.path, config);

/** 참조 절을 생성·검사할 문서인지. skipRefs 에 등록된 경로는 제외한다 */
export const wantsRefSection = (file: IndexedFile, config: SpecthreadConfig): boolean =>
  isTargetDoc(file, config) && !config.skipRefs.includes(file.path);

/** 문서 제목 헤딩 목록. 하나여야 정상이다 */
export const titleHeadings = (file: IndexedFile): Heading[] =>
  file.headings.filter((h) => h.level === 1);

/** 문서 제목의 헤딩. 하나가 아니면 null */
export const singleTitle = (file: IndexedFile): Heading | null => {
  const titles = titleHeadings(file);
  return titles.length === 1 ? titles[0] : null;
};

/**
 * skipCheck 의 객체 항목에 걸리는 지적인지.
 *
 * `{ path, only }` 는 해당 경로에서 `only` 에 나열된 규칙군만 유지한다는 뜻이다.
 * 그 밖의 규칙군에 속하는 지적은 여기서 걸러진다.
 */
export const isWorkExempt = (finding: Finding, config: SpecthreadConfig): boolean =>
  config.skipCheck.some((entry) => {
    if (typeof entry === "string") return false;
    if (!finding.file.startsWith(entry.path)) return false;
    const group = finding.rule.split("/")[0];
    return !entry.only.some((g) => g === group);
  });
