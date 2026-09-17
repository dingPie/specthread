/**
 * 문서 체계 값 - 여러 곳이 같은 값을 봐야 하는 것들.
 *
 * 두 곳에 같은 값을 두면 한쪽만 고쳤을 때 생성기와 검사기가 어긋난다. `TAIL_NAMES` 가
 * `utils/parse.ts` 와 `checks/headings.ts` 에 각각 있어 실제로 그 상태였다.
 *
 * 규칙 본문은 `docs/system/rules.md` 가 갖는다. 여기는 그 규칙이 쓰는 값만 담는다.
 */

/**
 * 꼬리 절 예약어 (`rules.md` §2-5).
 *
 * 파서가 꼬리 절 경계를 잡는 데 쓰고, 검사기가 본문 절이 이 이름을 쓰는지 본다.
 * 순서가 곧 문서 안 등장 순서다.
 */
// locale: ko
export const TAIL_NAMES = ['참조', '미확정 사항', '변경 이력'] as const;
