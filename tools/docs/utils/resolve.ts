/**
 * 절 참조 해소 - 문서에 적힌 이름을 리포 상대 경로로 푼다.
 *
 * 표기가 다섯 갈래로 갈려 있다. 경로 접두가 붙은 것, 파일명만 적은 것, 백틱에 감싼 것,
 * 확장자를 뺀 것, 마크다운 링크를 동반한 것. 어느 쪽이든 같은 한 규칙으로 다룬다 -
 * **같은 줄에서 왼쪽으로 가장 가까운 문서명** 을 대상으로 삼는다.
 */
import { basename, dirname, join, normalize } from "node:path";
import {
  anchorLinkLabelSpans,
  codeSpanMask,
  eachContentLine,
} from "./parse.ts";
import type { FileKind, SectionRef } from "../types.ts";

/** 절 참조. 중간 자리에 문자가 오는 `§1-B-1` 도 받는다 (`CLAUDE.md` §7 형태) */
const SECTION_REF = /§(\d+(?:-[0-9A-Za-z]+)*)/g;


/**
 * 문서 이름 → 경로 색인. basename 과 확장자 없는 stem 양쪽으로 넣는다.
 *
 * 코드 주석이 `data-conventions §2` 처럼 확장자를 빼고 적는 경우가 있어서 stem 도
 * 찾을 수 있어야 한다. 같은 이름의 문서가 여럿이면 (`CLAUDE.md` 가 루트와 client 에)
 * 값이 여러 개 담기고, 그때는 경로가 붙어 있지 않으면 대상을 특정할 수 없다.
 */
const buildNameMap = (paths: string[]): Map<string, string[]> => {
  const map = new Map<string, string[]>();
  const push = (key: string, path: string) => {
    const list = map.get(key) ?? [];
    list.push(path);
    map.set(key, list);
  };
  for (const p of paths) {
    const base = basename(p);
    push(base, p);
    push(base.replace(/\.md$/, ""), p);
  }
  return map;
};

/**
 * 문서명 하나를 경로로 푼다. 적힌 형태에 따라 세 갈래로 나뉜다.
 *
 * 상대 경로면 참조한 문서 위치를 기준으로 풀고, 경로 조각이 있으면 접미 일치로 찾고,
 * 이름만 있으면 색인에서 찾는다. 어느 쪽이든 후보가 둘 이상이면 특정하지 않는다 -
 * 추측해서 붙이면 검사가 엉뚱한 문서를 대조하게 된다.
 */
const resolveDocName = (
  raw: string,
  fromFile: string,
  mdPaths: string[],
  nameMap: Map<string, string[]>,
): { path: string | null; reason: SectionRef["reason"] } => {
  // 상대 경로는 참조한 문서 위치를 기준으로 푼다. `../` 를 그냥 벗기면
  // `../../CLAUDE.md` 가 `CLAUDE.md` 가 되어 루트와 client 중 어느 쪽인지 잃는다.
  if (/^\.{1,2}\//.test(raw)) {
    const resolved = normalize(join(dirname(fromFile), raw));
    return mdPaths.includes(resolved)
      ? { path: resolved, reason: "resolved" }
      : { path: null, reason: "unknown-doc" };
  }
  // `spec/player.md` 처럼 경로 조각이 붙은 형태는 접미 일치로 찾는다
  if (raw.includes("/")) {
    const hits = mdPaths.filter((p) => p === raw || p.endsWith("/" + raw));
    if (hits.length === 1) return { path: hits[0], reason: "resolved" };
    return {
      path: null,
      reason: hits.length > 1 ? "ambiguous-doc" : "unknown-doc",
    };
  }
  const hits = nameMap.get(raw) ?? [];
  if (hits.length === 1) return { path: hits[0], reason: "resolved" };
  return {
    path: null,
    reason: hits.length > 1 ? "ambiguous-doc" : "unknown-doc",
  };
};

/**
 * `§` 왼쪽에서 참조 대상으로 볼 문서명을 고른다. 없으면 null.
 *
 * **끝 위치가 가장 오른쪽인 후보를 고른다.** 시작 위치로 비교하면 `](../../CLAUDE.md)`
 * 안의 stem `CLAUDE` 가 전체 경로보다 늦게 시작해 이겨버리고, 경로가 주는 판별력을 잃는다.
 *
 * 고른 문서명과 `§` 사이에 한글이 끼면 버린다. 그 문서명은 참조 대상이 아니라 화제다 -
 * 실 참조는 사이에 공백·괄호·백틱·구분자만 온다.
 */
const nearestDocName = (left: string, knownStems: Set<string>): string | null => {
  const candidates: { text: string; end: number }[] = [];
  for (const named of left.matchAll(/([A-Za-z0-9_./-]+\.md)/g)) {
    candidates.push({ text: named[1], end: named.index + named[1].length });
  }
  for (const word of left.matchAll(/([A-Za-z][A-Za-z0-9-]*)/g)) {
    if (knownStems.has(word[1])) {
      candidates.push({ text: word[1], end: word.index + word[1].length });
    }
  }
  if (candidates.length === 0) {
    return null;
  }
  const best = candidates.reduce((a, b) => (b.end > a.end ? b : a));
  return /[가-힣]/.test(left.slice(best.end)) ? null : best.text;
};

/** 참조 해소에 필요한 문맥. 색인 대상 문서 목록에서 한 번 만들어 돌려 쓴다 */
export interface RefContext {
  mdPaths: string[];
  nameMap: Map<string, string[]>;
  knownStems: Set<string>;
}

/**
 * 색인 대상 문서 목록만으로 참조 해소 문맥을 만든다. 테스트에서도 이걸 쓴다.
 *
 * stem 은 두 글자 이하를 뺀다 - 짧은 낱말은 산문에서 우연히 겹칠 확률이 높다.
 */
export const makeRefContext = (mdPaths: string[], ignoreDocNames: string[] = []): RefContext => {
  const nameMap = buildNameMap(mdPaths);
  const deny = new Set(ignoreDocNames);
  return {
    mdPaths,
    nameMap,
    knownStems: new Set(
      [...nameMap.keys()].filter(
        (k) => !k.endsWith(".md") && k.length > 2 && !deny.has(k),
      ),
    ),
  };
};

/**
 * 한 파일의 절 참조를 모두 뽑아 해소한다.
 *
 * `battle.md §1·§4·§6` 같은 복수 절도 각 `§` 가 자기 왼쪽의 가까운 문서명에 붙으므로
 * 따로 다룰 필요가 없다. 문서명을 못 찾으면 마크다운은 자기 문서 참조로 보고
 * (표 안 `§4-1` 같은 것), 코드는 대상 불명으로 남긴다.
 */
export const parseSectionRefs = (
  path: string,
  kind: FileKind,
  lines: string[],
  { mdPaths, nameMap, knownStems }: RefContext,
): SectionRef[] => {
  const out: SectionRef[] = [];
  const scan = (line: string, i: number) => {
    const mask = kind === "md" ? codeSpanMask(line) : null;
    const linkedSpans = kind === "md" ? anchorLinkLabelSpans(line) : [];
    for (const m of line.matchAll(SECTION_REF)) {
      // 라벨 안에 있으면 그 링크의 대상이 정답이다. 라벨 글자로 풀면 경로를 잃는다
      const span = linkedSpans.find(
        (s) => m.index >= s.start && m.index < s.end,
      );
      // 코드 span 안에는 마크다운 링크를 넣을 수 없다. 주석 예시를 보여주는 자리라
      // 링크로 바꾸라고 요구하는 것 자체가 성립하지 않는다 (`rules.md` §3-5 가 코드
      // 주석에 링크가 없다고 인정한 것과 같은 상황). 절 존재 검사는 그대로 받는다
      const linked = span !== undefined || mask?.[m.index] === true;
      const docName =
        span?.target ?? nearestDocName(line.slice(0, m.index), knownStems);

      // 백틱 안에 문서명 없이 들어앉은 `§N` 은 표기법 인용이라 참조가 아니다
      if (mask?.[m.index] && docName === null) {
        continue;
      }

      if (docName === null) {
        out.push({
          num: m[1],
          targetFile: kind === "md" ? path : null,
          rawTarget: null,
          reason: kind === "md" ? "resolved" : "no-doc-name",
          linked,
          line: i + 1,
        });
        continue;
      }
      const { path: target, reason } = resolveDocName(
        docName,
        path,
        mdPaths,
        nameMap,
      );
      out.push({
        num: m[1],
        targetFile: target,
        rawTarget: docName,
        reason,
        linked,
        line: i + 1,
      });
    }
  };
  if (kind === "md") eachContentLine(lines, scan);
  else lines.forEach((l, i) => scan(l, i));
  return out;
};
