/**
 * 규칙 선언 대조 (`specthread/rules.md` §5).
 *
 * 코드에 있는 검사 id 가 규칙 문서에 선언됐는지 본다. 선언이 없으면 문서화되지 않은
 * 규칙을 강제하는 것이다. 역방향 (문서에만 있고 코드에 없는 것) 은 절 단위 판정이 애매해
 * 검사하지 않는다 - 병기가 없는 절이 곧 사람만 검사하는 규칙이다.
 */
import { RULES_PATH } from '../constants/paths.ts';
import { ALL_RULE_IDS, RULE } from '../constants/rules.ts';
import type { DocIndex, Finding } from '../types.ts';

/**
 * 지금 실제로 도는 검사 id 만.
 *
 * 기능을 끄면 그 검사는 돌지 않으므로 규칙 문서에 선언을 요구할 이유도 없다.
 * 끈 기능의 문서를 지웠다고 지적이 나오면 정리를 벌하는 셈이 된다.
 */
const enabledRuleIds = (index: DocIndex): readonly string[] => {
  const { features } = index.config;
  return ALL_RULE_IDS.filter((id) => {
    const group = id.split('/')[0];
    if (group === 'reference') return features.references;
    if (group === 'marker' || group === 'pending') return features.markers;
    return true;
  });
};

export const checkRuleDeclared = (index: DocIndex): Finding[] => {
  const doc = index.files.get(RULES_PATH);
  if (doc === undefined) return [];

  const text = doc.lines.join('\n');
  const heading = doc.headings.find((h) => h.title === '개요');

  return enabledRuleIds(index)
    .filter((id) => !text.includes(id))
    .map((id) => ({
      file: RULES_PATH,
      line: heading?.line ?? 1,
      rule: RULE.STYLE.RULE_UNDECLARED,
      message: `검사 id 가 규칙 문서에 선언되지 않았다 - ${id}`,
    }));
};
