# specthread

Spec-Driven Development (SDD) 도구. 문서가 단일 진실 원천이고, 검사/생성 도구가 문서 체계를 유지한다.

## 시작하기

```bash
npm install -g specthread
specthread init
specthread check
```

프로젝트 로컬로 쓰려면 `npm install -D specthread` 후 `npx specthread`로 실행한다.

`init`이 프로젝트에 SDD 체계를 세팅한다:

```
specthread/          ← 문서 규칙·설정·미확정 사항
  config.jsonc
  rules.md
  project.md
  pending.md
  templates/         ← 문서 골격 (check 대상 아님)
    spec.md
    plan.md
AGENTS.md            ← AI 도구 진입점
CLAUDE.md            ← Claude Code용 (@AGENTS.md)
.claude/skills/      ← Claude Code 스킬
```

기존 `AGENTS.md`가 있으면 `<!-- specthread:start/end -->` 마커로 섹션만 삽입한다. 기존 `CLAUDE.md`가 있으면 `@AGENTS.md` 줄만 추가한다.

| 종류 | 파일 | `init` | `init --force` |
| ---- | ---- | ------ | -------------- |
| 패키지 파일 | `rules.md`, `templates/`, `.claude/skills/` | 없을 때만 생성 | 새 버전으로 덮어씀 |
| 사용자 파일 | `config.jsonc`, `project.md`, `pending.md` | 없을 때만 생성 | 없을 때만 생성 |
| 병합 | `AGENTS.md` (마커 사이), `CLAUDE.md`, `.gitignore` | 병합 | 병합 |

설정을 처음 상태로 되돌리려면 `config.jsonc`를 지우고 `init`을 다시 실행한다.

## 명령어

```bash
npx specthread init [--tools claude,cursor]   # 프로젝트 초기화
npx specthread init --force                   # 패키지 파일을 새 버전으로 갱신 (사용자 파일은 유지)
npx specthread check                          # 문서 정합성 검사
npx specthread gen                            # 참조 절·목차·요약 표 미리보기
npx specthread gen --write                    # 실제 적용
```

### check

30개 규칙으로 문서 형식을 검사한다. 목차, 헤딩, 링크, 참조 절, 변경 이력, 미확정 마커 등.

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

배열과 `path` 는 통째로 교체되고, 나머지 객체는 키 단위로 합쳐진다. 잘못된 값이 있으면 파일과 키를 출력하고 종료 코드 2 로 끝난다. init이 생성하는 `config.jsonc`에 모든 옵션이 주석으로 설명되어 있고, `fileKinds`는 기본 확장자 목록이 실제 값으로 기록되므로 필요한 확장자를 그 자리에서 더하거나 뺄 수 있다.

| 키          | 역할                                       |
| ----------- | ------------------------------------------ |
| `path`      | 스캔 대상 경로 (자유 KV)                   |
| `fileKinds` | 확장자 → 종류 매핑 (`doc` / `source`)      |
| `features`  | 기능 플래그 (`markers`, `references`)      |
| `markers`   | 마커 종류·시점 라벨                        |
| `skipCheck` | 검사·생성을 건너뛸 경로                    |
| `skipRefs`  | 참조 절 생성을 건너뛸 경로                 |
| `work`      | 작업 문서 폴더 (기본 `docs/work/`)         |

`specthread/` 아래 규칙·미확정·프로젝트 문서의 위치는 고정이다. 템플릿과 설정 파일은 항상 검사에서 제외된다.

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

| 도구                              | 동작                                   |
| --------------------------------- | -------------------------------------- |
| Claude Code                       | `CLAUDE.md`의 `@AGENTS.md`가 자동 확장 |
| Cursor / Copilot / Codex / Gemini | `AGENTS.md`를 네이티브로 읽음          |

`--tools claude` (기본값)로 init하면 Claude Code 스킬이 함께 설치된다:

| 스킬          | 역할                          |
| ------------- | ----------------------------- |
| `/check`      | 문서 검사 실행 + 결과 해석    |
| `/gen`        | 참조 절·목차 생성 + 적용 안내 |
| `/plan-open`  | 작업 계획 문서 작성·검수·확정 |
| `/plan-run`   | 계획에 따라 실행·기록         |
| `/plan-close` | 완료된 작업을 spec에 흡수     |

스킬 없이 자연어로 같은 작업을 요청해도 된다. `AGENTS.md`가 AI에게 워크플로우를 알려주기 때문이다. 스킬은 자주 쓰는 흐름의 단축키다.

## 0.1.x 에서 올리기

0.2.0 은 설정 키 일부를 정리하고 규칙 3개를 더했다. 패키지를 올린 뒤 아래를 실행한다.

```bash
npm install -D specthread@latest
npx specthread init --force
```

`init --force` 는 `rules.md`·템플릿·스킬만 새 버전으로 바꾼다. 사용자 파일과, 0.1.x 가 마커 없이 만든 `AGENTS.md` 는 건드리지 않는다. 남은 정리는 AI 에게 아래 프롬프트로 맡긴다.

```
specthread 를 0.2.0 으로 올렸다. 아래를 순서대로 처리해줘.
내가 직접 쓴 내용은 지우지 말고, 판단이 필요하면 멈추고 물어봐.

0. specthread/rules.md 와 specthread/templates/ 를 고쳐 쓴 적이 있으면,
   다음 단계에서 덮어써지므로 먼저 커밋되어 있는지 확인한다.

1. AGENTS.md
   - `<!-- specthread:start -->` 표식이 없으면, specthread 가 만든 부분
     (`# specthread` 제목부터 그 섹션 끝까지)을 `<!-- specthread:start -->` 와
     `<!-- specthread:end -->` 로 감싼다. 그 밖의 내용은 그대로 둔다.
   - specthread 섹션이 두 번 들어가 있으면 뒤의 것을 지운다.

2. `npx specthread init --force` 를 실행한다.
   rules.md, 템플릿, 스킬, AGENTS.md 의 specthread 섹션이 새 버전으로 바뀐다.

3. specthread/config.jsonc
   - `"emDash"` 키와 그 주석을 지운다.
   - 주석으로만 남은 `locale`, `rules`, `pending`, `project` 블록을 지운다.
   - `rules`·`pending`·`project` 에 실제 값을 적어 쓰고 있었다면 지우지 말고 알려줘.
     이제 경로가 specthread/ 아래로 고정이라 파일을 옮겨야 한다.
   - `path` 에 일부 키만 적어 두었다면 알려줘. 이제 path 는 기본값과 합치지 않고
     통째로 교체되므로, docs/ 와 specthread/ 스캔이 빠질 수 있다.

4. specthread/project.md 의 "`config.jsonc` 에서 경로를 override 할 수 있다" 를
   "경로는 `specthread/pending.md` 고정이다" 로 바꾼다.

5. specthread/pending.md 의 "종류마다 `##` 섹션이 하나씩 생긴다. 종류 값은
   `config.markers.types` 가 정의하며" 를 "종류마다 `##` 섹션을 하나씩 둔다.
   섹션은 사람이 만들고, 종류 값은 `config.markers.types` 에 있어야 한다." 로 바꾼다.

6. `.claude/skills/` 바로 아래에 check.md, gen.md, plan-open.md, plan-run.md,
   plan-close.md 가 남아 있으면 같은 이름의 `<이름>/SKILL.md` 와 비교한다.
   내가 고친 부분이 없으면 지우고, 있으면 알려줘.

7. `npx specthread check` 를 실행한다.
   - `marker/unknown-type` 이 나오면 쓰고 있는 종류를 `config.markers.types` 에
     추가할지 물어봐.
   - `heading/tail-order` 가 나오면 꼬리 절을 참조 → 미확정 사항 → 변경 이력 순서로 옮긴다.

8. `npx specthread gen --write` 후 `npx specthread check` 가 0 건인지 확인한다.
```

바뀐 동작:

| 변경 | 영향 |
| ---- | ---- |
| `locale`, `rules`, `pending`, `project`, `features.emDash` 키 제거 | 남아 있으면 경고만 내고 동작한다 |
| `path` 통째 교체 | 일부 키만 적었다면 기본 `docs/`, `specthread/` 스캔이 빠진다 |
| 종료 코드 2 | 설정 파일이 없거나 설정을 읽지 못하면, 또는 모르는 명령이면 2 로 끝난다 |
| 규칙 추가 | `heading/tail-order`, `marker/unknown-type`, `pending/unknown-timepoint` |
| em dash 검사 제거 | `style/em-dash` 가 없어졌다 |
| 스킬 경로 | `.claude/skills/<이름>/SKILL.md` 로 바뀌었다. 옛 파일은 지우지 않고 알린다 |

## 요구 사항

- Node.js >= 18.0.0
- 외부 의존성 없음 (zero-dependency)

## 라이선스

MIT
