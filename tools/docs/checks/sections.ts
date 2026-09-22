import { RULE } from '../constants/rules.ts';
/**
 * 절 참조 유효성 - `§6-1` 이 실제로 존재하는 절을 가리키는가, 그리고
 * 다른 문서의 절이면 앵커 링크로 걸려 있는가.
 *
 * 번호 없는 헤딩은 § 대상이 될 수 없으므로 대조 집합에 들어가지 않는다.
 */
import { basename, dirname, relative } from "node:path";
import {
  inChangeLog,
  inRefSection,
  inToc,
  isCheckTarget,
  isHeadingLine,
} from "../utils/scope.ts";
import type { DocIndex, Finding, SectionRef } from "../types.ts";

/** 미해소 사유별 메시지 */
/**
 * 해소 실패 사유마다 규칙 id 와 메시지.
 *
 * 한 map 에 둘을 함께 담는다 - 따로 두면 같은 키를 가진 map 이 둘이 되어 한쪽에만
 * 사유를 더했을 때 갈라진다. id 를 `` `section-ref/${reason}` `` 처럼 조립하면
 * 정의처를 벗어난 id 가 생겨 `RuleId` 로도 grep 으로도 못 찾는다.
 */
const REASON = {
  "no-doc-name": {
    rule: RULE.SECTION_REF.NO_DOC_NAME,
    message: "문서명이 없어 대상을 특정할 수 없다",
  },
  "unknown-doc": {
    rule: RULE.SECTION_REF.UNKNOWN_DOC,
    message: "없는 문서를 가리킨다",
  },
  "ambiguous-doc": {
    rule: RULE.SECTION_REF.AMBIGUOUS_DOC,
    message: "같은 이름의 문서가 여럿이다",
  },
} as const;

/**
 * 문서별로 `§` 가 가리킬 수 있는 절 번호 집합을 만든다.
 *
 * 번호 없는 헤딩은 넣지 않는다 - 번호로 가리킬 수 없으므로 대조 대상이 아니다.
 */
const sectionNumbers = (index: DocIndex): Map<string, Set<string>> => {
  const byFile = new Map<string, Set<string>>();
  for (const file of index.files.values()) {
    // 절 번호는 문서만 갖는다. 코드·데이터에는 헤딩이 없다
    if (file.kind !== "doc") continue;
    const nums = new Set<string>();
    for (const heading of file.headings) {
      if (heading.num !== null) {
        nums.add(heading.num);
      }
    }
    byFile.set(file.path, nums);
  }
  return byFile;
};

/**
 * 고쳐 쓸 앵커 링크 자체를 만들어 지적 메시지에 실어준다.
 *
 * 색인이 절 번호 → 앵커 대응과 두 파일의 경로를 다 갖고 있으므로 상대 경로까지
 * 계산해 완성형을 보여줄 수 있다. 사람이 대상 문서를 열어 제목을 확인하는 일이 없어진다.
 * 이 계산이 그대로 자동 변환의 재료가 된다.
 */
const anchorLink = (
  index: DocIndex,
  fromFile: string,
  targetFile: string,
  num: string,
): string => {
  const anchor = index.files
    .get(targetFile)
    ?.headings.find((h) => h.num === num)?.anchor;
  const rel = relative(dirname(fromFile), targetFile);
  const path = rel.startsWith(".") ? rel : `./${rel}`;

  return `[\`${basename(targetFile)}\` §${num}](${path}#${anchor ?? "?"})`;
};

/** 해소되지 않은 참조. 어느 문서를 가리키는지 모르니 대조도 못 한다 */
const unresolvedFinding = (file: string, ref: SectionRef): Finding => {
  if (ref.reason === "resolved") {
    throw new Error("해소된 참조에는 쓰지 않는다");
  }
  const detail = ref.rawTarget === null ? "" : ` - ${ref.rawTarget}`;

  return {
    file,
    line: ref.line,
    rule: REASON[ref.reason].rule,
    message: `§${ref.num} ${REASON[ref.reason].message}${detail}`,
  };
};

/**
 * 참조 하나를 판정한다. 지적할 것이 없으면 null.
 *
 * 가드를 앞에 모으고 판정을 뒤에 두어 흐름이 한 방향으로 흐르게 한다.
 */
const inspect = (
  index: DocIndex,
  numsByFile: Map<string, Set<string>>,
  file: { path: string; kind: string },
  ref: SectionRef,
): Finding | null => {
  if (ref.reason !== "resolved") {
    return unresolvedFinding(file.path, ref);
  }
  // 해소됐다면 대상이 있다. 가드로 좁혀 두면 아래에서 단정이 필요 없다
  if (ref.targetFile === null) {
    return null;
  }
  const nums = numsByFile.get(ref.targetFile);

  if (!nums?.has(ref.num)) {
    const where = ref.rawTarget ?? "이 문서";
    return {
      file: file.path,
      line: ref.line,
      rule: RULE.SECTION_REF.MISSING,
      message: `${where} 에 §${ref.num} 절이 없다`,
    };
  }

  // 다른 문서의 절은 앵커 링크로 가리켜야 한다. 자기 절 참조와 코드 주석은 면제다
  if (file.kind === "doc" && !ref.linked && ref.targetFile !== file.path) {
    return {
      file: file.path,
      line: ref.line,
      rule: RULE.SECTION_REF.NOT_LINKED,
      message: `앵커 링크로 - ${anchorLink(index, file.path, ref.targetFile, ref.num)}`,
    };
  }

  return null;
};

/** 모든 파일의 절 참조를 훑는다 */
export const checkSectionRefs = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];
  const numsByFile = sectionNumbers(index);

  for (const file of index.files.values()) {
    // 코드·데이터도 문서의 절을 가리키므로 `md` 로 좁히지 않는다
    if (!isCheckTarget(file.path, index.config)) continue;

    for (const ref of file.sectionRefs) {
      if (file.ignored.has(ref.line) || inChangeLog(file, ref.line))
        continue;

      if (isHeadingLine(file, ref.line) || inToc(file, ref.line)) continue;

      if (inRefSection(file, ref.line)) continue;

      const finding = inspect(index, numsByFile, file, ref);
      if (finding !== null) {
        findings.push(finding);
      }
    }
  }

  return findings;
};
