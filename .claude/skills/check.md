---
description: 문서 정합성 검사를 실행하고 결과를 해석한다
---

# check

문서 규칙 위반을 검사하고, 결과를 해석해서 해결 방법을 안내한다.

## 실행

```bash
pnpm docs:check
```

## 결과 해석

출력은 두 부분으로 나뉜다:

1. **색인 요약** - 검사 대상 규모 (문서/코드/데이터 수, 헤딩/링크/마커 수, 인라인 억제 수)
2. **지적 목록** - 파일별 줄 번호 + 규칙 ID + 메시지

## 규칙 ID별 해결 방법

| 규칙 ID | 의미 | 해결 |
|---------|------|------|
| `toc/stale` | 목차가 헤딩과 어긋남 | `pnpm docs:generate --write` |
| `reference/stale` | 참조 절이 본문 링크와 어긋남 | `pnpm docs:generate --write` |
| `pending/section-stale` | 미확정 사항 절이 관리 문서와 어긋남 | `pnpm docs:generate --write` |
| `heading/tail-name-reused` | 본문 절 제목이 꼬리 절 이름과 같음 | 절 제목 변경 |
| `section-ref/not-linked` | 다른 문서 절 참조에 앵커 링크가 없음 | 앵커 링크로 변환 |
| `marker/orphan` | 마커를 가리키는 관리 문서 항목 없음 | `docs/pending.md`에 항목 추가 |
| `changelog/order` | 변경 이력 날짜 순서 어긋남 | 날짜 순 정렬 |
| `style/em-dash` | em dash 사용 | 하이픈으로 교체 |

## 행동 지침

1. 검사를 실행한다.
2. 지적이 0건이면 "문서 정합성 검사 통과"로 끝낸다.
3. 지적이 있으면:
   - `toc/stale`, `reference/stale`, `pending/section-stale`은 `pnpm docs:generate --write`로 한번에 해결할 수 있다고 안내한다.
   - 나머지는 규칙 ID별 해결 방법을 파일·줄 번호와 함께 안내한다.
   - 사용자가 수정을 요청하면 해당 파일을 직접 수정한다.
4. 수정 후 다시 검사를 실행해서 해결을 확인한다.
