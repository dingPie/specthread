/**
 * 문서 체계 값 - 여러 곳이 같은 값을 봐야 하는 것들.
 *
 * 두 곳에 같은 값을 두면 한쪽만 고쳤을 때 생성기와 검사기가 어긋난다.
 *
 * 규칙 본문은 `specthread/rules.md` 가 갖는다. 여기는 그 규칙이 쓰는 값만 담는다.
 */

/**
 * 꼬리 절 예약어 (`rules.md` §2-5).
 *
 * 파서가 꼬리 절 경계를 잡는 데 쓰고, 검사기가 본문 절이 이 이름을 쓰는지 본다.
 * 순서가 곧 문서 안 등장 순서다.
 */
export const TAIL = {
  REFS: '참조',
  PENDING: '미확정 사항',
  CHANGELOG: '변경 이력',
} as const;

export const TAIL_NAMES = [TAIL.REFS, TAIL.PENDING, TAIL.CHANGELOG] as const;
