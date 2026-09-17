/**
 * 헤딩 텍스트 → GitHub 앵커 변환.
 *
 * 목차 생성기와 링크 검사가 같은 규칙을 써야 하므로 한 곳에 둔다.
 * 규칙: 소문자화 → 영숫자·하이픈·밑줄·공백·CJK 외 제거 → 공백을 하이픈으로.
 *
 * **공백은 하나씩 바꾼다.** 여러 개를 하나로 합치지 않는다. `항목 · 형식` 처럼
 * 지워지는 구두점 양옆에 공백이 있으면 그 자리에 공백 둘이 남아 하이픈 둘이 된다.
 * 하이픈 자신은 허용 문자라 지워지지 않는다 - `항목 - 형식` 은 하이픈 셋이 된다.
 */
export const slugify = (text: string): string =>
  text
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');

/**
 * 헤딩 원문에서 앞머리 번호를 떼어낸다. `6-1. 기본 데미지` → `6-1` + `기본 데미지`
 *
 * 중간 자리에 문자가 오는 `1-B-1` 도 받는다 - `CLAUDE.md` §7 이 정한 형태다.
 */
export const splitHeadingNum = (raw: string): { num: string | null; title: string } => {
  const m = /^(\d+(?:-[0-9A-Za-z]+)*)\.\s+(.*)$/.exec(raw);
  return m ? { num: m[1], title: m[2] } : { num: null, title: raw };
};
