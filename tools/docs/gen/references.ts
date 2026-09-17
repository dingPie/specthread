/**
 * 참조 절 생성 - 본문 링크를 대상별로 모아 문서 하단 `## 참조` 절을 채운다.
 *
 * 참조 절은 **이 문서를 이해하려면 읽어야 하는 대상 목록** 이고, 대상의 어느 절을
 * 읽어야 하는지는 본문 인라인 링크가 갖는다 (`docs/system/rules.md` §3-3). 그래서
 * 라벨의 `§` 표기와 앵커는 떼고 파일만 남긴다 - 같은 대상을 한 줄로 합칠 때 서로
 * 다른 앵커 중 하나를 고를 근거도 없다.
 *
 * 줄 끝 `- §N` 은 방향이 반대다. **이 문서의 어느 절에서 가리켰는지** 를 적는
 * 역링크라서, 라벨 안 `§` 와 뜻이 겹치지 않는다.
 *
 * **소비자가 둘이다.** `bin/generate.ts` 가 파일에 쓰고, `checks/references.ts` 가 같은 함수를
 * 불러 지금 내용과 비교한다. 검사기가 생성기를 부르는 것이 거꾸로 보이지만,
 * _무엇이 옳은 내용인가_ 를 한곳에서만 정의하려면 이 방향이 맞다.
 */
import { basename, dirname, join, normalize } from "node:path";
import type { SpecthreadConfig } from "../config.schema.ts";
import { wantsRefSection } from "../utils/scope.ts";
import type { DocIndex, IndexedFile } from "../types.ts";

/** 대상 하나와 그것을 가리킨 이 문서의 절 번호들 */
type Target = { path: string; sections: string[] };

/** 코드·데이터 대상인지. 나머지 (`.md` · 디렉터리) 는 문서 쪽으로 간다 */
const isCode = (path: string): boolean => /\.(ts|tsx|json)$/.test(path);

/**
 * 링크 대상의 리포 루트 기준 위치. 같은 파일 이름이 겹칠 때 라벨로 쓴다.
 *
 * 앞머리만 떼면 구분이 사라진다 - `client/README.md` 안에서 `../CLAUDE.md` 와
 * `./CLAUDE.md` 는 서로 다른 파일인데 둘 다 `CLAUDE.md` 가 된다.
 */
const repoPath = (from: string, target: string): string =>
  normalize(join(dirname(from), target));

/**
 * 표시 이름의 기본값.
 *
 * 디렉터리 대상은 끝 `/` 를 남긴다. 확장자가 없어서 떼면 파일인지 폴더인지 안 보인다.
 */
const shortName = (path: string): string =>
  path.endsWith("/") ? `${basename(path)}/` : basename(path) || path;

/**
 * 본문 링크를 대상별로 묶는다.
 *
 * 꼬리 절 안의 링크는 넣지 않는다 - 생성 결과가 자기를 먹고 매 실행마다 자란다.
 * 앵커 전용 링크 (`(#...)`) 도 대상이 없으므로 빠진다.
 *
 * 순서는 본문 첫 등장 순이다. 목록을 본문과 나란히 놓고 대조할 수 있다.
 */
const collect = (file: IndexedFile): Target[] => {
  const byPath = new Map<string, Target>();
  const order: Target[] = [];

  for (const link of file.links) {
    const path = link.target;
    if (link.inTail || path === null) continue;

    let target = byPath.get(path);
    if (target === undefined) {
      target = { path, sections: [] };
      byPath.set(path, target);
      order.push(target);
    }
    // 번호 없는 헤딩 아래의 링크는 귀속 절이 없다. 그 경우 접미사를 통째로 생략한다
    if (link.section !== null && !target.sections.includes(link.section)) {
      target.sections.push(link.section);
    }
  }

  return order;
};

/**
 * 대상별 표시 이름.
 *
 * 기본은 파일 이름이고, 한 문서 안에서 같은 이름이 둘 이상 나오면 리포 안 위치를
 * 알 만큼 앞을 붙인다 - `CLAUDE.md` 는 루트와 client 두 곳에 있다.
 */
const labels = (from: string, targets: Target[]): Map<string, string> => {
  const seen = new Map<string, number>();
  for (const t of targets) {
    const name = shortName(t.path);
    seen.set(name, (seen.get(name) ?? 0) + 1);
  }

  const out = new Map<string, string>();
  for (const t of targets) {
    const name = shortName(t.path);
    out.set(t.path, (seen.get(name) ?? 0) > 1 ? repoPath(from, t.path) : name);
  }
  return out;
};

/** 항목 한 줄 */
const line = (target: Target, label: string): string => {
  const sections = target.sections.map((s) => `§${s}`).join(", ");
  return `- [\`${label}\`](${target.path})${sections === "" ? "" : ` - ${sections}`}`;
};

/**
 * 참조 절 본문. `## 참조` 헤딩과 다음 절 사이에 놓일 모양 그대로.
 *
 * 앞뒤 빈 줄을 포함한다 - 헤딩 줄은 색인 범위 밖이므로 생성기가 건드리지 않는다.
 * 수집된 대상이 없으면 빈 배열이다.
 */
export const referenceBlock = (file: IndexedFile, config: SpecthreadConfig): string[] => {
  if (!wantsRefSection(file, config)) return [];

  const targets = collect(file);
  if (targets.length === 0) return [];

  const label = labels(file.path, targets);
  const render = (list: Target[]) =>
    list.map((t) => line(t, label.get(t.path) ?? t.path));

  const docs = targets.filter((t) => !isCode(t.path));
  const code = targets.filter((t) => isCode(t.path));

  const out = [""];
  // 비는 갈래는 제목도 내지 않는다. 빈 제목만 남으면 아직 안 채운 것처럼 읽힌다
  if (docs.length > 0) out.push("### 문서", "", ...render(docs), "");
  if (code.length > 0) out.push("### 코드·데이터", "", ...render(code), "");
  return out;
};

/**
 * 참조 절을 새로 넣은 줄 목록.
 *
 * 꼬리 절 순서가 참조 → 미확정 사항 → 변경 이력 이므로 (`docs/system/rules.md`
 * 규칙 8) 뒤 두 개 중 먼저 오는 것 앞에 놓는다. 꼬리 절이 하나도 없으면 파일 끝에
 * 붙이고, 이때만 앞에 빈 줄을 하나 둔다 - 다른 자리는 앞 절이 이미 빈 줄로 끝난다.
 */
const insert = (file: IndexedFile, lines: string[], block: string[]): string[] => {
  const nextTail = file.headings.find((h) => h.level === 2 && h.tail);
  if (nextTail !== undefined) {
    const at = nextTail.line - 1;
    return [...lines.slice(0, at), "## 참조", ...block, ...lines.slice(at)];
  }

  // 파일 끝 빈 줄은 버린다. 블록이 빈 줄로 끝나므로 줄바꿈은 그쪽이 갖는다
  let end = lines.length;
  while (end > 0 && lines[end - 1].trim() === "") end--;
  return [...lines.slice(0, end), "", "## 참조", ...block];
};

/**
 * 참조 절을 채우거나 새로 넣은 문서 줄 목록. 바꿀 것이 없으면 null.
 */
export const applyReferences = (
  file: IndexedFile,
  lines: string[],
  index: DocIndex,
): string[] | null => {
  const block = referenceBlock(file, index.config);
  // 본문 링크가 없으면 참조 절을 둘 이유가 없다
  if (block.length === 0) return null;

  if (file.refSection === null) return insert(file, lines, block);

  const { start, end } = file.refSection;
  const current = lines.slice(start - 1, end);
  // 이미 맞으면 건드리지 않는다. 생성기를 두 번 돌려도 결과가 같아야 한다
  if (current.join("\n") === block.join("\n")) return null;

  return [...lines.slice(0, start - 1), ...block, ...lines.slice(end)];
};
