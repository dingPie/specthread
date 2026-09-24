/**
 * 문체 검사 (`docs/system/rules.md` §2-6).
 *
 * 지금은 em dash 하나다. `Write` / `Edit` 뒤에 도는 훅이 예방하지만 스크립트나 외부
 * 유입은 훅을 거치지 않으므로 상태를 보는 검사가 따로 필요하다.
 */
import { EM_DASH } from '../constants/patterns.ts';
import { ALL_RULE_IDS, RULE } from '../constants/rules.ts';
import { codeSpanMask } from '../utils/parse.ts';
import { isCheckTarget } from '../utils/scope.ts';
import type { DocIndex, Finding } from '../types.ts';

/**
 * 대상 문자를 소스에 갖는 파일. 훅과 이 검사가 서로를 망가뜨리지 않게 뺀다.
 *
 * 이 파일 자신은 리터럴 대신 `\u2014` 로 적어 목록에 넣지 않는다 - 훅 설정에 기대지
 * 않고 손상을 막는다.
 */
const SELF = ['tools/hooks/no-em-dash.mjs'];

export const checkStyle = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isCheckTarget(file.path, index.config) || SELF.includes(file.path)) continue;

    file.lines.forEach((raw, i) => {
      if (!raw.includes(EM_DASH)) return;
      // 백틱 안은 금지 문자를 인용한 것이다. 규칙 문서가 금지 예시를 그렇게 담는다
      const mask = codeSpanMask(raw);
      const at = [...raw].findIndex((c, k) => c === EM_DASH && !mask[k]);
      if (at < 0) return;
      findings.push({
        file: file.path,
        line: i + 1,
        rule: RULE.STYLE.EM_DASH,
        message: "em dash 를 쓰지 않는다. 하이픈 '-' 으로",
      });
    });
  }

  return findings;
};

/**
 * 코드에 있는 검사 id 가 규칙 문서에 선언됐는지.
 *
 * 선언이 없으면 문서화되지 않은 규칙을 강제하는 것이다. 역방향 (문서에만 있고 코드에
 * 없는 것) 은 절 단위 판정이 애매해 검사하지 않는다 - 병기가 없는 절이 곧 사람만
 * 검사하는 규칙이다.
 */
/**
 * 지금 실제로 도는 검사 id 만.
 *
 * 기능을 끄면 그 검사는 돌지 않으므로 규칙 문서에 선언을 요구할 이유도 없다.
 * 끈 기능의 문서를 지웠다고 지적이 나오면 정리를 벌하는 셈이 된다.
 */
const enabledRuleIds = (index: DocIndex): readonly string[] => {
  const { features } = index.config;
  return ALL_RULE_IDS.filter((id) => {
    if (id === RULE.STYLE.EM_DASH) return features.emDash;
    const group = id.split('/')[0];
    if (group === 'reference') return features.references;
    if (group === 'marker' || group === 'pending') return features.markers;
    return true;
  });
};

export const checkRuleDeclared = (index: DocIndex): Finding[] => {
  const rulesPath = index.config.rules;
  const doc = index.files.get(rulesPath);
  if (doc === undefined) return [];

  const text = doc.lines.join('\n');
  const heading = doc.headings.find((h) => h.title === '개요');

  return enabledRuleIds(index)
    .filter((id) => !text.includes(id))
    .map((id) => ({
      file: rulesPath,
      line: heading?.line ?? 1,
      rule: RULE.STYLE.RULE_UNDECLARED,
      message: `검사 id 가 규칙 문서에 선언되지 않았다 - ${id}`,
    }));
};
