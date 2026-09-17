/**
 * 관리 문서 항목 형식 (`docs/system/rules.md` §4-2).
 *
 * 이 검사는 관리 문서 한 파일에만 걸린다. 항목이 한곳에 모이는 것이 그 문서의 존재
 * 이유라서, 다른 문서에 같은 모양이 나타나면 그건 미확정 사항 절 (생성 뷰) 이고
 * 형식이 다르다 - 뷰는 `li`, 정본은 `###` 헤딩이다.
 */
import { timepointGlobal } from '../constants/patterns.ts';
import { RULE } from '../constants/rules.ts';
import { summaryBlocks } from '../gen/summary.ts';
import { invertByTarget, pendingSectionBlock } from '../gen/pending-section.ts';
import type { DocIndex, Finding, IndexedFile } from '../types.ts';

/** 항목 헤딩. id 뒤부터 줄 끝까지를 제목으로 본다 */
const ITEM = /^###\s+`\[[a-z]+::[a-z0-9][a-z0-9-]*\]`(.*)$/;

/** `li` 로 적힌 항목. 정본에서는 헤딩이어야 한다 */
const ITEM_AS_LI = /^\s*-\s+`\[[a-z]+::[a-z0-9][a-z0-9-]*\]`/;

/**
 * 문장이 끝난 흔적.
 *
 * 제목은 문장으로 끝나지 않는다. 헤딩에 종결이 나타나면 본문이 이어붙은 것이다.
 * 글자 수 상한을 쓰지 않는 이유는 그 숫자를 정하는 논쟁이 생기기 때문이다.
 */
const SENTENCE_END = /(다|음|함|것|임)\.(\s|$)|\.\s+\S/;

/** 한 줄 안의 선택지 표기. 둘 이상이면 `li` 로 내야 한다 */
const INLINE_OPTION = /[(（][a-zi0-9]{1,3}[)）]/g;

/** 시점 줄. 항목 헤딩 다음 첫 내용 줄에 온다 */
const TIMEPOINT_LINE = new RegExp(`^${timepointGlobal().source}$`);

/** 헤딩 안에 남은 시점 표기. 앵커가 시점에 묶이므로 막는다 */
const TIMEPOINT_INLINE = timepointGlobal();

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 항목 헤딩 하나. 제목만 담고 시점·본문은 아래 줄이 갖는다.
 *
 * 시점을 헤딩에서 막는 이유는 앵커다. 헤딩 문자열이 앵커가 되므로 시점이 거기 있으면
 * 마일스톤이 밀릴 때마다 그 항목을 가리키는 링크가 전부 깨진다. `§4-1` 이 같은 이유로
 * 마커에서 시점을 뺐다.
 */
const inspectHeading = (path: string, line: number, title: string): Finding[] => {
  const findings: Finding[] = [];
  const at = (rule: Finding['rule'], message: string) =>
    findings.push({ file: path, line, rule, message });

  TIMEPOINT_INLINE.lastIndex = 0;
  if (TIMEPOINT_INLINE.test(title)) {
    at(RULE.PENDING.TIMEPOINT, '작성일과 해결 예정은 헤딩 다음 줄에 적는다 - 헤딩은 앵커가 된다');
  }

  if (SENTENCE_END.test(title)) {
    at(RULE.PENDING.INLINE_BODY, '헤딩은 제목에서 끝난다. 본문은 아래 줄부터');
  }

  if ((title.match(INLINE_OPTION) ?? []).length >= 2) {
    at(RULE.PENDING.INLINE_OPTIONS, '선택지는 `li` 로 낸다');
  }

  return findings;
};

const inspectBody = (path: string, line: number, text: string): Finding[] => {
  const findings: Finding[] = [];

  if (ITEM_AS_LI.test(text)) {
    findings.push({
      file: path,
      line,
      rule: RULE.PENDING.ITEM_SHAPE,
      message: '항목은 `###` 헤딩으로 낸다. `li` 는 앵커를 못 가져 가리킬 수 없다',
    });
  }

  if ((text.match(INLINE_OPTION) ?? []).length >= 2) {
    findings.push({
      file: path,
      line,
      rule: RULE.PENDING.INLINE_OPTIONS,
      message: '선택지는 `li` 로 낸다',
    });
  }

  if (/\]\(\.?\.?\/?work\//.test(text) || /`work\//.test(text)) {
    findings.push({
      file: path,
      line,
      rule: RULE.PENDING.WORK_LINK,
      message: '작업 문서는 흡수 후 사라진다. 근거를 항목 안으로 옮겨 적는다',
    });
  }

  return findings;
};

/** 항목 헤딩 다음 첫 내용 줄이 시점인지 */
const inspectTimepoint = (file: IndexedFile, at: number): Finding[] => {
  for (let i = at; i < file.lines.length; i++) {
    const line = file.lines[i].trim();
    if (line === '') continue;

    const stamp = TIMEPOINT_LINE.exec(line);
    if (stamp === null) {
      return [
        {
          file: file.path,
          line: i + 1,
          rule: RULE.PENDING.TIMEPOINT,
          message: '항목 헤딩 다음 줄은 `작성일 <날짜>` 이고 `/ 해결 예정 <라벨>` 이 붙을 수 있다',
        },
      ];
    }
    if (stamp[2] !== undefined && ISO_DATE.test(stamp[2].trim())) {
      return [
        {
          file: file.path,
          line: i + 1,
          rule: RULE.PENDING.TIMEPOINT,
          message: `해결 예정에 달력 날짜를 쓰지 않는다 - ${stamp[2].trim()}`,
        },
      ];
    }
    return [];
  }

  // 헤딩 뒤에 아무 줄도 없으면 시점 줄이 빠진 것이다
  return [
    {
      file: file.path,
      line: at,
      rule: RULE.PENDING.TIMEPOINT,
      message: '항목 헤딩 다음 줄은 `작성일 <날짜>` 이고 `/ 해결 예정 <라벨>` 이 붙을 수 있다',
    },
  ];
};

/**
 * 절 머리 요약 표 ↔ 항목 일치.
 *
 * 목차·참조 절과 같은 구조다. 생성물이라 손으로 고치면 어긋나고, 어긋남 자체가
 * `docs:generate` 를 돌려야 한다는 신호다.
 */
const inspectSummary = (file: IndexedFile, index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const { blockStart, blockEnd, block } of summaryBlocks(file.lines, index)) {
    const actual = file.lines.slice(blockStart - 1, blockEnd);
    const rows = (lines: string[]) => lines.filter((l) => l.startsWith('| [')).length;

    if (rows(actual) === 0) {
      findings.push({
        file: file.path,
        line: blockStart,
        rule: RULE.PENDING.SUMMARY_MISSING,
        message: `절 머리에 요약 표가 없다 - 항목 ${rows(block)} 개`,
      });
      continue;
    }
    if (actual.join('\n') !== block.join('\n')) {
      findings.push({
        file: file.path,
        line: blockStart,
        rule: RULE.PENDING.SUMMARY_STALE,
        message: `요약 표가 항목과 어긋난다 - 적힌 것 ${rows(actual)} / 항목 ${rows(block)}`,
      });
    }
  }

  return findings;
};

/**
 * 문서 미확정 사항 절 ↔ 관리 문서 백링크 일치.
 *
 * 목차·참조 절과 같은 구조다. `docs/pending.md` 를 제외한 모든 문서가 대상이다 -
 * 절 자체가 없는 문서는 `gen/pending-section.ts` 가 건드리지 않으므로 지적도 없다.
 */
const inspectPendingSection = (index: DocIndex): Finding[] => {
  const pending = index.files.get(index.config.pending);
  if (pending === undefined) return [];

  const byTarget = invertByTarget(pending);
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (file.path === index.config.pending || file.pendingSection === null) continue;

    const expected = pendingSectionBlock(file, byTarget, index);
    const actual = file.lines.slice(file.pendingSection.start - 1, file.pendingSection.end);
    const count = (lines: string[]) => lines.filter((l) => l.startsWith('- [`')).length;

    if (actual.join('\n') !== expected.join('\n')) {
      findings.push({
        file: file.path,
        line: file.pendingSection.start,
        rule: RULE.PENDING.SECTION_STALE,
        message: `미확정 사항 절이 관리 문서와 어긋난다 - 적힌 것 ${count(actual)} / 관리 문서 ${count(expected)}`,
      });
    }
  }

  return findings;
};

export const checkPending = (index: DocIndex): Finding[] => {
  const file: IndexedFile | undefined = index.files.get(index.config.pending);
  if (file === undefined) return [];

  const findings: Finding[] = [];
  let inChangeLog = false;

  file.lines.forEach((raw, i) => {
    const line = i + 1;
    if (raw.startsWith('## 변경 이력')) inChangeLog = true;
    if (inChangeLog) return;

    const item = ITEM.exec(raw);
    if (item) {
      findings.push(...inspectHeading(file.path, line, item[1]));
      findings.push(...inspectTimepoint(file, line));
      return;
    }
    findings.push(...inspectBody(file.path, line, raw));
  });

  return [...findings, ...inspectSummary(file, index), ...inspectPendingSection(index)];
};
