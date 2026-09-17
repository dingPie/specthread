# specthread

Spec-Driven Development (SDD) 도구. 문서가 단일 진실 원천이고, 검사/생성 도구가 문서 체계를 유지한다.

## 시작하기

```bash
npm install -D specthread
npx specthread init
npx specthread check
```

`init`이 프로젝트에 SDD 체계를 세팅한다:

```
specthread/          ← 문서 규칙·설정·미확정 사항
  config.jsonc
  rules.md
  project.md
  pending.md
docs/templates/      ← 문서 골격 (수정 가능, check 대상)
  spec.md
  plan.md
AGENTS.md            ← AI 도구 진입점
CLAUDE.md            ← Claude Code용 (@AGENTS.md)
.claude/skills/      ← Claude Code 스킬
```

기존 `AGENTS.md`가 있으면 `<!-- specthread:start/end -->` 마커로 섹션만 삽입한다. 기존 `CLAUDE.md`가 있으면 `@AGENTS.md` 줄만 추가한다.

## 명령어

```bash
npx specthread init [--tools claude,cursor]   # 프로젝트 초기화
npx specthread check                          # 문서 정합성 검사
npx specthread gen                            # 참조 절·목차·요약 표 미리보기
npx specthread gen --write                    # 실제 적용
```

### check

28개 규칙으로 문서 형식을 검사한다. 목차, 헤딩, 링크, 참조 절, 변경 이력, 미확정 마커 등.

### gen

본문 링크와 헤딩을 기반으로 목차·참조 절·미확정 사항 요약을 생성한다. `--write` 없이 실행하면 변경 대상만 보여준다.

## 설정

`specthread/config.jsonc`로 프로젝트별 동작을 제어한다. 개인 오버라이드는 `specthread/config.local.jsonc` (gitignore 대상).

```
Core defaults (도구 내부 기본값)
  ↓ deep merge
specthread/config.jsonc (프로젝트 공유)
  ↓ deep merge
specthread/config.local.jsonc (개인)
```

설정이 없으면 기본값으로 동작한다. init이 생성하는 `config.jsonc`에 모든 옵션이 주석으로 설명되어 있다.

| 키 | 역할 |
|---|---|
| `path` | 스캔 대상 경로 (자유 KV) |
| `features` | 기능 플래그 (`markers`, `emDash`, `references`) |
| `markers` | 마커 종류·시점 라벨 |
| `docTypes` | 경로별 템플릿·프론트매터 스키마 |
| `skipCheck` | 검사 건너뛸 경로 |
| `skipRefs` | 참조 절 생성 건너뛸 경로 |

## SDD 작업 흐름

```
스펙 확인 → 현황 점검(check) → 계획 수립 → 구현 → 검증(check) → 문서 갱신
```

구현 전에 spec을 읽고, 구현 후에 spec을 갱신한다. 진행 중 모호함을 발견하면 `PENDING` 마커를 남기고 작업을 계속한다.

### 예시: 기존 인증 spec에 소셜 로그인 추가

`docs/spec/auth.md`가 이미 있는 프로젝트에서 소셜 로그인을 추가한다:

```
You: 소셜 로그인 기능 계획 세워줘
AI:  docs/spec/auth.md 를 읽고, plan 템플릿 기반으로
     docs/work/social-login.md 생성.
     목표, 작업 단계, 영향 파일을 함께 채운다.
     문서 정합성 검사 통과.
```

```
You: 진행해줘
AI:  작업 단계 1 "OAuth 프로바이더 연동" 구현.
     세션 관리 방식이 미확정이라
     PENDING::design::oauth-session 마커를 남긴다.
     단계 상태를 "완료"로 갱신.
```

```
You: 전부 끝났어, 정리해줘
AI:  종료 게이트 점검 후,
     작업 내용을 docs/spec/auth.md §3 에 흡수.
     docs/work/social-login.md 삭제.
     문서 정합성 검사 통과.
```

결과: `docs/spec/auth.md`에 소셜 로그인 절이 추가되고, work 문서는 사라진다. spec이 항상 현재 시스템의 정본으로 남는다.

AI는 작업 중에 `check`와 `gen`을 자동으로 호출한다. `AGENTS.md`가 이 워크플로우를 AI에게 전달하고, `check`가 문서와 코드의 어긋남을 잡는다.

## AI 도구 지원

`AGENTS.md`가 본체. 대부분의 AI 코딩 도구가 이 파일을 읽는다.

| 도구 | 동작 |
|------|------|
| Claude Code | `CLAUDE.md`의 `@AGENTS.md`가 자동 확장 |
| Cursor / Copilot / Codex / Gemini | `AGENTS.md`를 네이티브로 읽음 |

`--tools claude` (기본값)로 init하면 Claude Code 스킬이 함께 설치된다:

| 스킬 | 역할 |
|------|------|
| `/check` | 문서 검사 실행 + 결과 해석 |
| `/gen` | 참조 절·목차 생성 + 적용 안내 |
| `/plan-open` | 작업 계획 문서 작성·검수·확정 |
| `/plan-run` | 계획에 따라 실행·기록 |
| `/plan-close` | 완료된 작업을 spec에 흡수 |

스킬 없이 자연어로 같은 작업을 요청해도 된다. `AGENTS.md`가 AI에게 워크플로우를 알려주기 때문이다. 스킬은 자주 쓰는 흐름의 단축키다.

## 요구 사항

- Node.js >= 18.0.0
- 외부 의존성 없음 (zero-dependency)

## 라이선스

MIT
