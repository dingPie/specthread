---
description: 참조 절·목차·요약 표를 생성하고 결과를 안내한다
---

# gen

본문 링크와 헤딩을 기반으로 참조 절·목차·미확정 사항 요약 표를 생성한다.

## 실행

미리보기 (변경 대상만 확인):

```bash
npx specthread gen
```

실제 적용:

```bash
npx specthread gen --write
```

## 생성 항목

| 항목 | 동작 | 조건 |
|------|------|------|
| 참조 절 | 본문 링크를 모아 `## 참조` 절을 채움 | `features.references: true` |
| 목차 | 번호 헤딩을 모아 목차 블록을 갱신 | 항상 |
| 미확정 사항 절 | `specthread/pending.md` 항목을 문서별 `## 미확정 사항` 절에 반영 | `features.markers: true` |
| 요약 표 | 미확정 사항 절 머리에 종류·시점·마커 수 표를 채움 | `features.markers: true` |

## 행동 지침

1. 먼저 미리보기(`npx specthread gen`)를 실행한다.
2. 변경 대상 파일 목록을 사용자에게 보여준다.
3. 변경이 0건이면 "생성할 변경 사항 없음"으로 끝낸다.
4. 변경이 있으면:
   - 어떤 파일의 어떤 절이 갱신되는지 요약한다.
   - 사용자에게 적용 여부를 확인한다.
   - 승인하면 `npx specthread gen --write`를 실행한다.
5. 적용 후 `npx specthread check`를 실행해서 생성 관련 지적(`toc/stale`, `reference/stale`, `pending/section-stale`)이 해소되었는지 확인한다.
