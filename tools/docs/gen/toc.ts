/**
 * 목차 생성 - `##` 헤딩을 모아 제목 아래 블록을 채운다.
 *
 * 목차는 같은 정보가 두 곳에 생기는 대표 사례라 손으로 관리하면 반드시 어긋난다
 * (`docs/system/rules.md` §2-2). 여기서 만드는 문자열이 검사기의 기대값도 된다.
 *
 * **소비자가 둘이다.** `bin/generate.ts` 가 파일에 쓰고, `checks/toc.ts` 가 같은 함수를
 * 불러 지금 내용과 비교한다. 검사기가 생성기를 부르는 것이 거꾸로 보이지만,
 * _무엇이 옳은 내용인가_ 를 한곳에서만 정의하려면 이 방향이 맞다.
 */
import { slugify } from "../utils/anchor.ts";
import { parseHeadings } from "../utils/parse.ts";
import { singleTitle } from "../utils/scope.ts";
import type { Heading, IndexedFile } from "../types.ts";

/**
 * 목차 줄 목록. 목차를 둘 이유가 없으면 빈 배열.
 *
 * `##` 만 넣는다. `###` 까지 넣으면 목차가 본문보다 긴 문서가 나온다.
 * 꼬리 절도 넣는다 - 참조·미확정 사항·변경 이력이 어디 있는지 알아야 한다.
 */
export const tocLines = (headings: Heading[]): string[] =>
  headings
    .filter((h) => h.level === 2)
    .map((h) => `- [${h.raw}](#${slugify(h.raw)})`);

/** 목차 블록 전체. 제목 다음에 놓일 모양 그대로 */
export const tocBlock = (headings: Heading[]): string[] => {
  const lines = tocLines(headings);
  return lines.length === 0 ? [] : ["**목차**", "", ...lines];
};

/**
 * 목차를 넣거나 갈아끼운 문서 줄 목록. 바꿀 것이 없으면 null.
 *
 * 이미 있으면 그 블록만 갈아끼우고, 없으면 제목 다음 빈 줄 뒤에 넣는다.
 * 제목이 없거나 둘 이상인 문서는 건드리지 않는다 - 어디에 넣을지 정할 근거가 없다.
 * 검사기가 `heading/multiple-title` 로 따로 지적한다.
 *
 * 고칠 줄 목록을 따로 받는다. 한 파일에 생성기를 둘 이상 걸 때 앞 생성기의 결과
 * 위에 이어 쓰기 위함이다. 색인의 줄 번호가 그대로 유효하려면 **문서 아래쪽을
 * 고치는 생성기부터** 돌려야 한다.
 *
 * 헤딩은 색인이 아니라 넘겨받은 줄에서 다시 읽는다. 앞 생성기가 절을 새로 끼워
 * 넣었으면 그 절이 목차에 실려야 한다.
 */
export const applyToc = (file: IndexedFile, lines: string[]): string[] | null => {
  const block = tocBlock(parseHeadings(lines));

  // `##` 절이 없으면 목차를 둘 이유가 없다
  if (block.length === 0) return null;

  const title = singleTitle(file);
  if (title === null) return null;

  if (file.tocBlock !== null) {
    const { start, end } = file.tocBlock;
    const current = lines.slice(start - 1, end);
    // 이미 맞으면 건드리지 않는다. 생성기를 두 번 돌려도 결과가 같아야 한다
    if (current.join("\n") === block.join("\n")) {
      return null;
    }
    return [...lines.slice(0, start - 1), ...block, ...lines.slice(end)];
  }

  // 제목 줄은 색인에서 꺼낸다. 본문을 다시 훑으면 펜스 안 `# ` 를 제목으로 볼 수 있다
  return [
    ...lines.slice(0, title.line),
    "",
    ...block,
    ...lines.slice(title.line),
  ];
};
