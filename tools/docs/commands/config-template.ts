/**
 * init 이 생성하는 config.jsonc 본문.
 *
 * 값은 DEFAULT_CONFIG 에서 보간한다. scaffold 에 사본을 두면 기본값이 두 곳이 되고,
 * 한쪽만 고쳐도 아무 곳에서도 드러나지 않는다.
 */
import type { SpecthreadConfig } from "../config.schema.ts";

/** 한 줄이 너무 길어지지 않게 확장자를 묶는다. 항목 추가 시 뒤쪽만 흐른다 */
const wrapList = (items: string[], indent: string, width = 72): string => {
  const lines: string[] = [];
  let line = "";
  items.forEach((item, i) => {
    const piece = `"${item}"${i < items.length - 1 ? "," : ""}`;
    const next = line === "" ? piece : `${line} ${piece}`;
    if (indent.length + next.length > width && line !== "") {
      lines.push(indent + line);
      line = piece;
      return;
    }
    line = next;
  });
  if (line !== "") lines.push(indent + line);
  return lines.join("\n");
};

const inlineList = (items: string[]): string =>
  `[${items.map((i) => `"${i}"`).join(", ")}]`;

export const renderConfig = (c: SpecthreadConfig): string => `{
  // ── specthread 설정 ──────────────────────────────────────────────
  // 생략한 키는 기본값이 적용된다. 개인 설정은 config.local.jsonc (gitignore 대상).

  // ── 파일 종류 ────────────────────────────────────────────────────
  // 확장자 → 종류 매핑. 아래는 기본값이고, 필요한 확장자를 더하거나 뺄 수 있다.
  // doc: 기획 소스. 풀파싱 대상 (헤딩, 링크, 목차, 참조절, 마커).
  // source: 문서 외 참조 파일. 마커 + 절참조 스캔만.
  "fileKinds": {
    "doc": ${inlineList(c.fileKinds.doc)},
    "source": [
${wrapList(c.fileKinds.source, "      ")}
    ]
  },

  // ── 스캔 대상 경로 ───────────────────────────────────────────────
  // 자유 KV. 키는 용도 라벨, 값은 경로 배열.
  // 디렉터리면 재귀 스캔, 파일이면 직접 로드.
  // 예: "source": ["client/src/"], "data": ["data/"]
  //     "meta": ["CLAUDE.md", "AGENTS.md"]
  "path": {
${Object.entries(c.path)
  .map(([k, v]) => `    "${k}": ${inlineList(v)}`)
  .join(",\n")}
  },

  // ── 기능 플래그 ──────────────────────────────────────────────────
  // 기능 단위 on/off. 개별 규칙이 아닌 기능 묶음으로 제어한다.
  "features": {
    // 마커 체계 전체. false → marker/*, pending/* 검사 + pending 추적 비활성화
    "markers": ${c.features.markers},
    // em dash 검사. false → style/em-dash 비활성화
    "emDash": ${c.features.emDash},
    // 참조 절 자동 생성. false → reference/* 검사 + gen references 스킵
    "references": ${c.features.references}
  },

  // ── 마커 체계 ────────────────────────────────────────────────────
  "markers": {
    // 마커 종류. "system" 은 코어 예약, 나머지는 프로젝트 정의.
    // 예: ["system", "design", "balance", "deps"]
    "types": ${inlineList(c.markers.types)},
    // 처리 시점 라벨. 마일스톤 등.
    // 예: ["M1", "M2", "M3"]
    "timepoints": ${inlineList(c.markers.timepoints)}
  }

  // ── 문서명 해소 무시 (기본값: []) ────────────────────────────────
  // 절 참조가 파일명과 잘못 매칭되는 것을 방지한다.
  // "ignoreDocNames": ["spec"]

  // ── 검사 제외 (기본값: []) ───────────────────────────────────────
  // 경로 prefix 로 전체 검사를 건너뛰거나, 특정 군만 검사한다.
  // "skipCheck": [
  //   "docs/archive/",
  //   { "path": "docs/drafts/", "only": ["heading", "link"] }
  // ]

  // ── 참조 절 생성 제외 (기본값: []) ──────────────────────────────
  // 이 경로 prefix 의 문서에는 참조 절을 생성하지 않는다.
  // "skipRefs": ["specthread/templates/"]

  // ── 로케일 (기본값: "ko") ───────────────────────────────────────
  // 현재 한국어 고정. 검사 메시지, 꼬리 절 이름, 시점 정규식 등에 영향.
  // "locale": "ko"

  // ── 규약 경로 ────────────────────────────────────────────────────
  // 도구가 직접 읽고 쓰는 파일. path 와 별개.
  // "rules": "${c.rules}",
  // "pending": "${c.pending}",
  // "project": "${c.project}",
  // "work": "${c.work}"
}
`;
