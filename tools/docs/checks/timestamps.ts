import { timepointGlobal } from '../constants/patterns.ts';
import { RULE } from '../constants/rules.ts';
/**
 * 본문 시점 표기 - 날짜를 본문에 남기지 않는가 (`docs/system/rules.md` §2-1).
 *
 * 문서 본문은 현재 상태와 근거만 서술하고, _누가 언제 무엇을 뒤집었는가_ 는 변경 이력이
 * 갖는다. §2-1 이 금지하는 다섯 가지 중 **날짜만** 여기서 본다. 나머지 (시점을 함의하는
 * 낱말·구버전 대비 서술·결정 사건 라벨) 는 낱말 매칭으로는 오탐이 커서 의미를 읽는
 * 검토에 맡긴다 - `신규 5 종` 같은 콘텐츠 서술까지 걸린다.
 */
import { codeSpanMask, linkTargetSpans } from "../utils/parse.ts";
import { inChangeLog, inToc, isTargetDoc } from "../utils/scope.ts";
import type { DocIndex, Finding } from "../types.ts";

const DATE = /20\d\d-\d\d-\d\d/g;

/** 시점 표기가 차지한 자리 */
const timepointSpans = (text: string): { start: number; end: number }[] =>
  [...text.matchAll(timepointGlobal())].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));

export const checkTimestamps = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;

    let fence = false;
    file.lines.forEach((text, i) => {
      if (/^\s*(```|~~~)/.test(text)) {
        fence = !fence;
        return;
      }

      const line = i + 1;
      // 펜스는 예시, 변경 이력은 날짜가 있어야 하는 자리, 목차는 헤딩을 복사한 생성물이다
      if (fence || inChangeLog(file, line) || inToc(file, line)) return;

      const mask = codeSpanMask(text);
      const urls = linkTargetSpans(text);
      const stamps = timepointSpans(text);
      for (const m of text.matchAll(DATE)) {
        // 백틱 안 날짜는 표기법 인용이다. §2-1 표가 금지 예시를 그렇게 담고 있다
        if (mask[m.index]) continue;
        // 링크 대상 안 날짜는 앵커 문자열의 일부다. 대상 문서 제목이 날짜를 담고 있어
        // 생긴 것이므로 그 문서를 검사할 때 잡힌다
        if (urls.some((u) => m.index >= u.start && m.index < u.end)) continue;
        // 관리 문서 항목의 시점 표기는 항목 속성이다
        if (stamps.some((s) => m.index >= s.start && m.index < s.end)) continue;
        findings.push({
          file: file.path,
          line,
          rule: RULE.TIMESTAMP.BODY_DATE,
          message: `본문에 날짜 - ${m[0]}. 변경 이력으로 옮긴다`,
        });
      }
    });
  }

  return findings;
};
