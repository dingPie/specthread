/**
 * 마크다운 한 파일에서 색인 재료를 뽑는다 - 헤딩·링크·마커·미확정 항목과
 * 생성기가 덮어쓸 블록의 위치.
 *
 * 펜스 코드블록 안은 전부 무시한다. 템플릿이 골격을 코드블록으로 담고 있어서
 * 추적하지 않으면 헤딩 88 개와 링크 90 개가 오탐으로 잡힌다.
 */
import { TAIL_NAMES } from '../constants/docs.ts';
import { slugify, splitHeadingNum } from './anchor.ts';
import type {
  AnchorLabelSpan,
  FileKind,
  Heading,
  IndexedFile,
  Link,
  Marker,
  PendingItem,
  Range,
} from '../types.ts';

/**
 * 꼬리 절 이름. 하나가 나오면 그 뒤는 전부 꼬리다.
 *
 * 꼬리 절은 문서 맨 끝에 순서대로 오므로 (`docs/system/rules.md` 규칙 8) 첫 꼬리
 * 헤딩부터 파일 끝까지를 꼬리로 보면 된다. 하위 절 (`### 문서` 등) 도 따라 잡힌다.
 */
const TAIL_SET = new Set<string>(TAIL_NAMES);

/**
 * 펜스 코드블록 바깥의 줄만 넘겨준다.
 *
 * 펜스 여는 줄과 닫는 줄 자체도 넘기지 않는다. 여닫이를 구분하지 않고 토글만
 * 하므로 언어 표기가 붙은 ` ```markdown ` 도 그대로 잡힌다.
 */
export const eachContentLine = (
  lines: string[],
  fn: (line: string, index: number) => void,
): void => {
  let fence = false;
  lines.forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence;
      return;
    }
    if (!fence) fn(line, i);
  });
};

/**
 * 인라인 백틱 코드 스팬 위치. 각 문자가 코드 안인지 표시한다.
 *
 * 백틱 안 `§1-A-3` 은 표기법을 인용한 것이지 참조가 아니다. 반대로
 * `` `skill-tree.md §4` `` 처럼 문서명을 함께 담은 것은 실 참조라서, 스팬 안에
 * 문서명이 있는지로 갈라야 한다. 위치만 계산해 두고 판정은 참조 파서가 한다.
 */
export const codeSpanMask = (line: string): boolean[] => {
  const mask = new Array<boolean>(line.length).fill(false);
  let open = -1;
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== '`') continue;
    if (open < 0) open = i;
    else {
      for (let j = open; j <= i; j++) mask[j] = true;
      open = -1;
    }
  }
  return mask;
};

/**
 * 앵커가 붙은 마크다운 링크의 라벨 구간.
 *
 * `[`battle.md` §7](./battle.md#7-승리---패배-조건)` 처럼 라벨 안에 놓인 `§` 는 이미
 * 앵커로 걸린 참조라 정상이다. 반대로 라벨 밖 `§` 는 링크 없이 적은 것이다.
 * 절 참조 파서가 이 구간으로 둘을 가른다.
 */
export const anchorLinkLabelSpans = (line: string): AnchorLabelSpan[] => {
  const spans: AnchorLabelSpan[] = [];
  for (const m of line.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    if (!m[2].includes('#')) continue;
    const labelStart = m.index + 1;
    spans.push({
      start: labelStart,
      end: labelStart + m[1].length,
      target: m[2].split('#')[0],
    });
  }
  return spans;
};

/** 마크다운 링크의 대상 `(...)` 구간. URL 안 문자열을 본문과 가르는 데 쓴다 */
export const linkTargetSpans = (line: string): Range[] => {
  const spans: Range[] = [];
  for (const m of line.matchAll(/\]\(([^)\s]+)\)/g)) {
    const start = m.index + 2;
    spans.push({ start, end: start + m[1].length });
  }
  return spans;
};

/** 새 형식 마커. 종류와 slug 를 함께 캡처한다 */
const MARKER_NEW = /PENDING::([a-z]+)::([a-z0-9][a-z0-9-]*)/g;
/** 구 `TEMP_*` 형식. slug 가 없어 큐와 묶이지 않으므로 재편에서 치환한다 */
const MARKER_LEGACY = /TEMP_(DESIGN|BALANCE|DEPS|STYLE)\b/g;
/** JSON 안 마커. 데이터에는 주석을 못 달아서 필드로 표기한다 */
const PENDING_JSON = /"_pending"\s*:\s*"([a-z]+)::([a-z0-9][a-z0-9-]*)"/g;
/** JSON 안 구 형식 마커 */
const TEMP_JSON = /"_temp"\s*:\s*"([a-z]+)"/g;
/**
 * 미확정 항목. 마커와 달리 `PENDING` 접두가 없다.
 *
 * 세 모양을 받는다 - 관리 문서 항목은 `###` 헤딩 (`` `[slug]` ``), 문서 미확정 사항
 * 절은 생성된 백링크 (`` [`slug`](...) ``), 둘 다 아닌 `li` (`` - `[slug]` ``) 는
 * 낡은 형식이다. 형식 판정은 `checks/pending.ts` 가 하고 여기는 세는 일만 한다.
 */
const PENDING_ITEM = /^(?:\s*-|###)\s+[`\[]+([a-z]+)::([a-z0-9][a-z0-9-]*)[`\]]+/;
/** 마크다운 링크. 대상에 공백이 없다고 보고 잡는다 */
const LINK = /\[([^\]]*)\]\(([^)\s]+)\)/g;
/** 변경 이력 표의 첫 칸 날짜 */
const CHANGELOG_DATE = /^\|\s*(\d{4}-\d{2}-\d{2})/;

/**
 * 마커를 모은다. 새 형식과 구 형식을 갈라 담으므로 재편 진척을 셀 수 있다.
 *
 * 마크다운은 펜스 안을 건너뛰고 (템플릿이 마커 예시를 코드블록에 담는다),
 * 코드와 JSON 은 전부 훑는다.
 */
export const parseMarkers = (lines: string[], kind: FileKind): Marker[] => {
  const out: Marker[] = [];
  const scan = (line: string, i: number) => {
    for (const m of line.matchAll(MARKER_NEW))
      out.push({ kind: m[1], slug: m[2], line: i + 1, legacy: false });
    for (const m of line.matchAll(MARKER_LEGACY))
      out.push({ kind: m[1].toLowerCase(), slug: '', line: i + 1, legacy: true });
    if (kind === 'json') {
      for (const m of line.matchAll(PENDING_JSON))
        out.push({ kind: m[1], slug: m[2], line: i + 1, legacy: false });
      for (const m of line.matchAll(TEMP_JSON))
        out.push({ kind: m[1], slug: '', line: i + 1, legacy: true });
    }
  };
  if (kind === 'md') eachContentLine(lines, scan);
  else lines.forEach((l, i) => scan(l, i));
  return out;
};

/**
 * 제목 다음 `**목차**` 블록 범위. 생성기가 이 자리를 덮어쓴다.
 *
 * 제목 바로 아래 몇 줄만 본다 - 본문 중간의 목록을 목차로 오인하지 않기 위함이다.
 * 첫 `##` 헤딩을 만나면 목차가 없는 문서로 판정한다.
 */
const findTocBlock = (lines: string[]): Range | null => {
  const head = lines.findIndex((l) => /^#\s+/.test(l));
  if (head < 0) return null;
  for (let i = head + 1; i < Math.min(head + 6, lines.length); i++) {
    if (/^#{2,}\s/.test(lines[i])) return null;
    if (!/^\*\*목차\*\*/.test(lines[i])) continue;
    // 한 줄에 몰아 쓴 인라인 나열은 그 줄이 블록 전체다. 규칙 12 위반이라
    // 생성기가 목록 형태로 갈아끼운다
    if (lines[i].trim() !== '**목차**') return { start: i + 1, end: i + 1 };
    let end = i;
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\s*-\s+\[/.test(lines[j])) end = j;
      else if (lines[j].trim() === '') continue;
      else break;
    }
    return { start: i + 1, end: end + 1 };
  }
  return null;
};

/**
 * 꼬리 절 하나의 범위. 그 헤딩 다음 줄부터 다음 `##` 앞까지.
 *
 * 헤딩 목록에서 뽑기 때문에 시작이 끝보다 커지는 일이 구조적으로 없다. 훑으면서
 * 상태로 들고 가면, 같은 이름의 절이 두 번 나올 때 시작만 덮어써져 범위가 뒤집힌다.
 */
const tailRange = (headings: Heading[], title: string, lineCount: number): Range | null => {
  const at = headings.findIndex((h) => h.level === 2 && h.tail && h.title === title);
  if (at < 0) {
    return null;
  }
  const heading = headings[at];
  const next = headings.slice(at + 1).find((h) => h.level === 2);
  return { start: heading.line + 1, end: next === undefined ? lineCount : next.line - 1 };
};

/**
 * 헤딩만 뽑는다.
 *
 * 색인과 따로 부를 수 있어야 한다. 생성기가 절을 새로 끼워 넣으면 헤딩 목록이
 * 바뀌므로, 뒤따르는 생성기는 색인이 아니라 **갱신된 줄** 에서 다시 읽어야 한다.
 *
 * 문서 제목 (`#`) 도 담는다. 절은 아니지만 제목이 둘인 문서를 가려내야 하고,
 * 절 판정은 모두 `level === 2` 로 걸러 쓴다.
 */
export const parseHeadings = (lines: string[]): Heading[] => {
  const headings: Heading[] = [];
  eachContentLine(lines, (line, i) => {
    const h = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (h === null) return;

    const { num, title } = splitHeadingNum(h[2]);
    headings.push({
      level: h[1].length,
      num,
      title,
      raw: h[2],
      anchor: slugify(h[2]),
      line: i + 1,
      // 꼬리 절은 최상위 절이다. 하위 절이 같은 이름을 쓰더라도 꼬리로 보지 않는다 -
      // 그러면 문서 중간에서 inTail 이 켜져 뒤의 링크가 전부 꼬리로 잡힌다
      tail: h[1].length === 2 && TAIL_SET.has(title),
    });
  });
  return headings;
};

/**
 * 문서 한 개를 훑어 색인 항목을 만든다. 절 참조는 별도로 해소하므로 빠져 있다.
 *
 * 훑으면서 들고 가는 상태는 두 개뿐이다 - 직전 헤딩 번호 (링크를 절에 귀속시킨다) 와
 * 꼬리 절 진입 여부. 절 범위는 훑기가 끝난 뒤 헤딩 목록에서 뽑는다.
 */
export const parseMarkdown = (
  path: string,
  lines: string[],
): Omit<IndexedFile, 'sectionRefs' | 'ignored'> => {
  const headings = parseHeadings(lines);
  const headingAt = new Map(headings.map((h) => [h.line, h]));
  const links: Link[] = [];
  const pendingItems: PendingItem[] = [];
  const dated: { line: number; date: string }[] = [];

  let currentSection: string | null = null;
  let inTail = false;

  eachContentLine(lines, (line, i) => {
    // 항목은 헤딩 줄에도 올 수 있다 (관리 문서). 헤딩 분기보다 먼저 본다
    const item = PENDING_ITEM.exec(line);
    if (item) {
      pendingItems.push({ kind: item[1], slug: item[2], line: i + 1 });
    }

    const h = headingAt.get(i + 1);
    if (h !== undefined) {
      if (h.tail) inTail = true;
      if (h.num !== null) currentSection = h.num;
      return;
    }

    for (const m of line.matchAll(LINK)) {
      const [rawTarget, anchor] = m[2].split('#');
      links.push({
        label: m[1],
        // `(#앵커)` 처럼 대상이 비면 자기 문서 안 링크다
        target: rawTarget === '' ? null : rawTarget,
        anchor: anchor ?? null,
        line: i + 1,
        section: currentSection,
        inTail,
      });
    }

    const date = CHANGELOG_DATE.exec(line);
    if (date) {
      dated.push({ line: i + 1, date: date[1] });
    }
  });

  const changeLogRange = tailRange(headings, '변경 이력', lines.length);
  // 본문에도 날짜 표가 있을 수 있어서 변경 이력 절 안의 것만 센다
  const inLog = (line: number) =>
    changeLogRange !== null && line >= changeLogRange.start && line <= changeLogRange.end;

  return {
    path,
    kind: 'md',
    lines,
    headings,
    links,
    markers: parseMarkers(lines, 'md'),
    pendingItems,
    tocBlock: findTocBlock(lines),
    refSection: tailRange(headings, '참조', lines.length),
    pendingSection: tailRange(headings, '미확정 사항', lines.length),
    changeLogRange,
    changeLogDates: dated.filter((d) => inLog(d.line)).map((d) => d.date),
  };
};
