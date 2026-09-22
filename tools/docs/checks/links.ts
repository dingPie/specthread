import { RULE } from '../constants/rules.ts';
/** 링크 유효성 - 대상 파일이 있는가, 앵커가 실제 헤딩을 가리키는가. */
import { existsSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';
import { REPO_ROOT } from '../utils/scan.ts';
import { inChangeLog, inRefSection, isTargetDoc } from '../utils/scope.ts';
import type { DocIndex, Finding } from '../types.ts';

/** 외부 링크는 파일 시스템에 없으니 확인하지 않는다 */
const isExternal = (target: string) => /^(https?:|mailto:)/.test(target);

/**
 * 링크를 두 단계로 본다 - 대상 파일이 있는가, 그 문서에 앵커가 있는가.
 *
 * 앵커 대조는 색인 안에 있는 문서만 한다. 색인 밖 (`archive/` 등) 은 헤딩을 모르므로
 * 존재 확인까지만 하고 넘어간다.
 */
export const checkLinks = (index: DocIndex): Finding[] => {
  const findings: Finding[] = [];

  for (const file of index.files.values()) {
    if (!isTargetDoc(file, index.config)) continue;
    const anchors = new Set(file.headings.map((h) => h.anchor));

    for (const link of file.links) {
      if (inChangeLog(file, link.line)) continue;
      // 참조 절의 대상은 본문 링크를 그대로 옮긴 것이라 여기서 깨졌으면 본문에서도
      // 깨져 있다. 고칠 자리는 본문이고, 참조 절은 다시 생성하면 따라온다
      if (inRefSection(file, link.line)) continue;
      if (link.target === null) {
        if (link.anchor && !anchors.has(link.anchor))
          findings.push({
            file: file.path,
            line: link.line,
            rule: RULE.LINK.ANCHOR,
            message: `자기 문서에 앵커 #${link.anchor} 가 없다`,
          });
        continue;
      }
      if (isExternal(link.target)) continue;

      const rel = normalize(join(dirname(file.path), link.target));
      if (!existsSync(join(REPO_ROOT, rel))) {
        findings.push({
          file: file.path,
          line: link.line,
          rule: RULE.LINK.TARGET,
          message: `대상이 없다 - ${link.target}`,
        });
        continue;
      }
      if (!link.anchor || !rel.endsWith('.md')) continue;

      const target = index.files.get(rel);
      // 색인 범위 밖 문서 (archive 등) 는 앵커를 확인하지 않는다
      if (!target) continue;
      if (!target.headings.some((h) => h.anchor === link.anchor))
        findings.push({
          file: file.path,
          line: link.line,
          rule: RULE.LINK.ANCHOR,
          message: `${link.target} 에 앵커 #${link.anchor} 가 없다`,
        });
    }
  }

  return findings;
};
