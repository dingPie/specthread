/**
 * 여러 검사가 같은 형식을 봐야 할 때 쓰는 정규식과 문자.
 *
 * 한 형식을 두 검사가 각자 표현하면 하나를 고칠 때 다른 하나가 남는다.
 *
 * 한 검사만 쓰는 정규식은 그 파일에 둔다. 여기 모으면 어디서 쓰는지 알 수 없어진다.
 */

/** 마커·항목 id 의 두 부분. 종류는 영소문자, slug 는 영소문자·숫자·하이픈 */
const KIND = '[a-z]+';
const SLUG = '[a-z0-9][a-z0-9-]*';

/** 코드·문서 마커. 종류와 slug 를 캡처한다 */
export const MARKER = new RegExp(`PENDING::(${KIND})::(${SLUG})`, 'g');

/** JSON 안 마커. 데이터에는 주석을 못 달아서 필드로 표기한다 */
export const PENDING_JSON = new RegExp(`"_pending"\\s*:\\s*"(${KIND})::(${SLUG})"`, 'g');

/** 관리 문서 항목 헤딩. id (`종류::slug`) 와 제목을 캡처한다 */
export const ITEM_HEADING = new RegExp(`^###\\s+\`\\[(${KIND}::${SLUG})\\]\`\\s*(.*)$`);

/** `li` 로 적힌 항목. 정본에서는 헤딩이어야 한다 */
export const ITEM_AS_LI = new RegExp(`^\\s*-\\s+\`\\[${KIND}::${SLUG}\\]\``);

/**
 * 미확정 항목 세 모양. 종류와 slug 를 캡처한다.
 *
 * 관리 문서 항목은 `###` 헤딩 (`` `[slug]` ``), 문서 미확정 사항 절은 생성된 백링크
 * (`` [`slug`](...) ``), 둘 다 아닌 `li` (`` - `[slug]` ``) 는 낡은 형식이다.
 */
export const PENDING_ITEM = new RegExp(`^(?:\\s*-|###)\\s+[\`\\[]+(${KIND})::(${SLUG})[\`\\]]+`);

/**
 * 관리 문서 항목의 시점 표기 (`rules.md` §4-2).
 *
 * `작성일 <ISO 날짜>` 에 `/ 해결 예정 <라벨>` 이 붙을 수 있다. 낱말이 두 값을 갈라
 * 말하므로 방향을 나타내는 기호가 필요 없다. `해결 예정` 이 없으면 미정이다.
 */
export const TIMEPOINT = /작성일\s+(\d{4}-\d{2}-\d{2})(?:\s*\/\s*해결 예정\s+([^\n]+))?/;

/** 전역 플래그가 필요한 자리용. 같은 형식을 두 번 적지 않으려고 여기서 만든다 */
export const timepointGlobal = (): RegExp => new RegExp(TIMEPOINT.source, 'g');
