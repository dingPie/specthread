/**
 * 설정에 적힌 경로와 색인 경로의 대조.
 *
 * skipCheck·skipRefs·work 는 모두 "이 경로 아래" 를 뜻하므로 같은 함수로 판정한다.
 */

/**
 * 설정에 적힌 경로를 색인 경로와 같은 형태로 만든다.
 *
 * 색인 경로는 루트 기준 상대 경로이고 `./` 도 끝 `/` 도 없다. 역슬래시는 `/` 로 바꾼다.
 * 빈 문자열은 루트 전체다.
 */
export const normalizeConfigPath = (raw: string): string => {
  let p = raw.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  while (p.startsWith("./")) p = p.slice(2);
  if (p === ".") p = "";

  p = p.replace(/^\/+/, "").replace(/\/+$/, "");
  return p;
};

/**
 * path 가 base 아래에 있는지. 디렉터리 경계로 판정한다.
 *
 * `docs` 는 `docs/a.md` 를 포함하고 `docs-old/a.md` 는 포함하지 않는다. 파일 경로를
 * 정확히 적으면 그 파일 하나에 해당한다. base 는 정규화된 값이어야 한다.
 */
export const underPath = (path: string, base: string): boolean =>
  base === "" || path === base || path.startsWith(`${base}/`);
