import { TAIL_NAMES } from '../constants/docs.ts';
import { RULE } from '../constants/rules.ts';
/**
 * 헤딩 구조 - 제목이 하나인가, 꼬리 절 이름을 본문에서 재사용하지 않는가,
 * 꼬리 절에 번호가 붙지 않았는가.
 *
 * 둘 다 생성기가 자리를 잘못 짚게 만드는 원인이다. 꼬리 절은 이름으로 찾으므로
 * 이름이 겹치면 어느 쪽이 꼬리인지 가릴 수 없고, 번호가 붙으면 규칙 8 과 어긋난다.
 */
import { isTargetDoc, titleHeadings } from "../utils/scope.ts";
import type { DocIndex, Finding } from "../types.ts";

/** 꼬리 절 이름. `parse.ts` 의 판정과 같은 목록이어야 한다 */


export const checkHeadings = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;

    // 제목이 둘이면 목차를 어디에 둘지 정할 근거가 없다. 생성기도 이 문서를 건너뛴다
    const titles = titleHeadings(file);
    if (titles.length > 1) {
      findings.push({
        file: file.path,
        line: titles[1].line,
        rule: RULE.HEADING.MULTIPLE_TITLE,
        message: `문서 제목이 ${titles.length} 개다 - 하나여야 한다`,
      });
    }

    for (const heading of file.headings) {
      // 꼬리 이름과 겹치는 제목만 본다. 나머지는 이 검사의 관심 밖이다
      if (!TAIL_NAMES.includes(heading.title as (typeof TAIL_NAMES)[number])) continue;

      // 번호가 붙었으면 본문 절로 쓰려 한 것이거나 꼬리 절에 번호를 남긴 것이다.
      // 둘을 가릴 수 없으므로 위치로 판단한다 - 뒤에 번호 있는 `##` 이 더 오면 본문이다
      const laterNumbered = file.headings.some(
        (h) => h.level === 2 && h.line > heading.line && h.num !== null,
      );

      if (heading.num !== null && laterNumbered) {
        findings.push({
          file: file.path,
          line: heading.line,
          rule: RULE.HEADING.TAIL_NAME_REUSED,
          message: `본문 절 제목이 꼬리 절 이름과 같다 - \`${heading.raw}\``,
        });
        continue;
      }
      if (heading.num !== null) {
        findings.push({
          file: file.path,
          line: heading.line,
          rule: RULE.HEADING.NUMBERED_TAIL,
          message: `꼬리 절에 번호가 붙었다 - \`${heading.raw}\``,
        });
      }
    }
  }

  return findings;
};
