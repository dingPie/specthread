/**
 * 규칙 id 별 해결 방법. check 가 규칙별 집계에, gen 이 건너뛴 문서 목록에 함께 낸다.
 *
 * 지적 메시지는 무엇이 어긋났는지를 말하고, 여기는 어떻게 고치는지를 말한다. 출력에
 * 해결 방법이 있어야 에이전트가 생성 절을 손으로 고치지 않고 gen 을 실행한다.
 * `Record<RuleId, string>` 이라 규칙을 더하면 여기도 채워야 컴파일된다.
 */
import { TAIL_NAMES } from './docs.ts';
import { PENDING_PATH, RULES_PATH } from './paths.ts';
import { RULE, type RuleId } from './rules.ts';

const GEN = 'npx specthread gen --write';

export const FIX: Record<RuleId, string> = {
  [RULE.CHANGELOG.ORDER]: '변경 이력 행을 날짜가 오래된 순으로 정렬한다',

  [RULE.HEADING.MULTIPLE_TITLE]: '`#` 제목을 하나만 남기고 나머지는 `##` 이하로 바꾼다',
  [RULE.HEADING.NUMBERED_TAIL]: '꼬리 절 제목에서 번호를 지운다',
  [RULE.HEADING.TAIL_NAME_REUSED]: '본문 절 제목을 꼬리 절 이름과 다르게 바꾼다',
  [RULE.HEADING.TAIL_ORDER]: `꼬리 절을 ${TAIL_NAMES.join(' → ')} 순서로 옮긴 뒤 ${GEN}`,

  [RULE.LINK.TARGET]: '대상 경로를 고치거나 링크를 지운다',
  [RULE.LINK.ANCHOR]: '대상 문서의 헤딩에 맞게 앵커를 고친다',

  [RULE.MARKER.ORPHAN]: `${PENDING_PATH} 에 항목을 추가하거나 마커를 지운다`,
  [RULE.MARKER.UNMARKED]:
    '해결된 항목이면 관리 문서에서 지우고, 아니면 해당 위치에 마커를 둔다. 문서 전체에 해당하는 항목은 헤딩 위에 `<!-- @specthread-ignore -->`',
  [RULE.MARKER.UNKNOWN_TYPE]: '종류를 고치거나 `config.markers.types` 에 추가한다',

  [RULE.PENDING.INLINE_BODY]: '항목 헤딩 줄에는 id 와 제목만 두고 본문은 다음 문단으로 옮긴다',
  [RULE.PENDING.INLINE_OPTIONS]: '선택지를 `- (a) ...` 목록으로 나눈다',
  [RULE.PENDING.TIMEPOINT]: '헤딩 다음 줄을 `작성일 <날짜>` 또는 `작성일 <날짜> / 해결 예정 <라벨>` 로 고친다',
  [RULE.PENDING.UNKNOWN_TIMEPOINT]: '라벨을 고치거나 `config.markers.timepoints` 에 추가한다',
  [RULE.PENDING.ITEM_SHAPE]: '항목을 `###` 헤딩으로 바꾼다',
  [RULE.PENDING.SUMMARY_MISSING]: GEN,
  [RULE.PENDING.SUMMARY_STALE]: GEN,
  [RULE.PENDING.SECTION_STALE]: GEN,

  [RULE.REFERENCE.MISSING]: GEN,
  [RULE.REFERENCE.STALE]: GEN,

  [RULE.SECTION_REF.MISSING]: '절 번호를 대상 문서에 있는 절로 고친다',
  [RULE.SECTION_REF.NOT_LINKED]: '메시지에 나온 앵커 링크로 바꾼다',
  [RULE.SECTION_REF.UNKNOWN_DOC]: '문서 이름을 고치거나 앵커 링크로 바꾼다',
  [RULE.SECTION_REF.AMBIGUOUS_DOC]: '경로가 들어간 앵커 링크로 바꾼다',
  [RULE.SECTION_REF.NO_DOC_NAME]: '문서 이름을 붙이거나 앵커 링크로 바꾼다',

  [RULE.STYLE.RULE_UNDECLARED]: `${RULES_PATH} 의 해당 절에 검사 id 를 적는다`,

  [RULE.TIMESTAMP.BODY_DATE]: '날짜를 변경 이력으로 옮긴다',

  [RULE.TOC.MISSING]: GEN,
  [RULE.TOC.STALE]: GEN,
};
