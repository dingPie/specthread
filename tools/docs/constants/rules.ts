/**
 * 검사 규칙 id 의 단일 정의처.
 *
 * 각 검사 파일이 문자열 리터럴을 들고 있으면 오타가 컴파일을 통과하고, 이름을 바꿀 때
 * 파일을 훑어야 하며, 규칙 전체 목록을 얻을 곳이 없다. 여기 모아 `Finding.rule` 을
 * `RuleId` 로 좁히면 오타가 타입 오류가 되고 이 파일이 곧 목록이 된다.
 *
 * id 는 `<군>/<검사>` 형태다. 군 이름은 `checks/<군>.ts` 와 대응하므로 id 를 보면
 * 어느 파일을 열어야 하는지 나온다. 한 파일이 한 군을 갖고, 한 군은 여러 검사를 갖는다 -
 * 같은 파싱을 반복하지 않기 위해서다.
 *
 * 규칙 본문은 `docs/system/rules.md` 가 갖고 각 절이 자기 id 를 병기한다.
 */

export const RULE = {
  CHANGELOG: {
    /** 변경 이력이 오래된 순이 아니다 */
    ORDER: 'changelog/order',
  },
  HEADING: {
    /** 제목이 둘 이상이다 */
    MULTIPLE_TITLE: 'heading/multiple-title',
    /** 꼬리 절에 번호가 붙었다 */
    NUMBERED_TAIL: 'heading/numbered-tail',
    /** 꼬리 절 예약어를 본문 절이 쓴다 */
    TAIL_NAME_REUSED: 'heading/tail-name-reused',
  },
  LINK: {
    /** 링크 대상 파일이 없다 */
    TARGET: 'link/target',
    /** 링크 대상에 그 앵커가 없다 */
    ANCHOR: 'link/anchor',
  },
  MARKER: {
    /** 마커 slug 가 관리 문서 항목에 없다 */
    ORPHAN: 'marker/orphan',
    /** 관리 문서 항목을 가리키는 마커가 없다 */
    UNMARKED: 'marker/unmarked',
  },
  PENDING: {
    /** 항목 첫 줄에 본문이 이어붙었다 */
    INLINE_BODY: 'pending/inline-body',
    /** 선택지를 한 줄 안에 늘어놓았다 */
    INLINE_OPTIONS: 'pending/inline-options',
    /** 흡수 후 사라지는 작업 문서를 가리킨다 */
    WORK_LINK: 'pending/work-link',
    /** 시점 표기가 형식에 안 맞는다 */
    TIMEPOINT: 'pending/timepoint',
    /** 항목이 `li` 로 적혀 있다. 관리 문서 항목은 헤딩이라 앵커를 갖는다 */
    ITEM_SHAPE: 'pending/item-shape',
    /** 절 머리 요약 표가 없다 */
    SUMMARY_MISSING: 'pending/summary-missing',
    /** 절 머리 요약 표가 항목과 어긋난다 */
    SUMMARY_STALE: 'pending/summary-stale',
    /** 문서의 미확정 사항 절이 관리 문서 백링크와 어긋난다. 절이 없는 문서는 대상 밖 */
    SECTION_STALE: 'pending/section-stale',
  },
  REFERENCE: {
    /** 참조 절이 없다 */
    MISSING: 'reference/missing',
    /** 참조 절이 본문 링크와 어긋난다 */
    STALE: 'reference/stale',
  },
  SECTION_REF: {
    /** 가리킨 절이 대상 문서에 없다 */
    MISSING: 'section-ref/missing',
    /** 절 참조가 링크로 걸려 있지 않다 */
    NOT_LINKED: 'section-ref/not-linked',
    /** 가리킨 문서 이름을 못 찾았다 */
    UNKNOWN_DOC: 'section-ref/unknown-doc',
    /** 같은 이름의 문서가 여럿이라 특정할 수 없다 */
    AMBIGUOUS_DOC: 'section-ref/ambiguous-doc',
    /** 문서명이 없어 대상을 특정할 수 없다 */
    NO_DOC_NAME: 'section-ref/no-doc-name',
  },
  STYLE: {
    /** em dash 를 썼다 */
    EM_DASH: 'style/em-dash',
    /** 코드에 있는 검사 id 가 규칙 문서에 선언되지 않았다 */
    RULE_UNDECLARED: 'style/rule-undeclared',
  },
  TIMESTAMP: {
    /** 본문에 날짜가 있다 */
    BODY_DATE: 'timestamp/body-date',
  },
  TOC: {
    /** 목차가 없다 */
    MISSING: 'toc/missing',
    /** 목차가 헤딩과 어긋난다 */
    STALE: 'toc/stale',
  },
} as const;

/** 중첩 구조에서 잎 문자열만 뽑는다 */
type Leaf<T> = T extends string ? T : Leaf<T[keyof T]>;

export type RuleId = Leaf<typeof RULE>;

/** RuleId 에서 슬래시 앞 군 이름만 뽑는다. skipCheck.only 검증에 쓴다 */
export type RuleGroup = RuleId extends `${infer G}/${string}` ? G : never;

/** 정의된 모든 id. 규칙 문서와의 대조에 쓴다 */
export const ALL_RULE_IDS: readonly RuleId[] = Object.values(RULE).flatMap(
  (group) => Object.values(group),
) as RuleId[];

/** 정의된 모든 군 이름. skipCheck.only 런타임 검증에 쓴다 */
export const ALL_RULE_GROUPS: readonly RuleGroup[] = [
  ...new Set(ALL_RULE_IDS.map((id) => id.split("/")[0])),
] as RuleGroup[];
