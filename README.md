# specthread

Spec-Driven Development(SDD) 도구입니다. 문서를 단일 정본으로 관리하고, 문서 형식 규칙과 그 규칙을 검사·생성하는 도구를 함께 제공합니다.

AI 와 함께 코드를 작성하면 문서와 코드가 쉽게 어긋납니다. specthread 는 문서 형식을 규칙으로 정하고, 규칙 위반과 생성물의 불일치를 `check` 로 검출합니다. 목차·참조 절처럼 다른 내용에서 만들 수 있는 부분은 `gen` 이 생성합니다.

## 시작하기

```bash
npm install -D specthread
npx specthread init
npx specthread check
```

전역으로 설치하려면 `npm install -g specthread` 후 `specthread` 로 실행합니다.

## init 이 만드는 파일

```
specthread/
  config.jsonc       설정
  rules.md           문서 형식 규칙
  project.md         설정값의 맥락과 근거
  pending.md         미확정 사항 정본
  templates/         문서 골격 (검사 대상 아님)
    spec.md
    plan.md
AGENTS.md            AI 도구 진입점
CLAUDE.md            Claude Code 용 (@AGENTS.md)
.claude/skills/      Claude Code 스킬
```

기존 `AGENTS.md` 가 있으면 `<!-- specthread:start -->` 와 `<!-- specthread:end -->` 표식 사이에만 specthread 섹션을 넣습니다. 기존 `CLAUDE.md` 에는 `@AGENTS.md` 줄만 추가하고, `.gitignore` 에는 개인 설정 파일 경로를 추가합니다.

| 종류 | 파일 | `init` | `init --force` |
| ---- | ---- | ------ | -------------- |
| 패키지 파일 | `rules.md`, `templates/`, `.claude/skills/` | 없을 때만 생성 | 새 버전으로 덮어씀 |
| 사용자 파일 | `config.jsonc`, `project.md`, `pending.md` | 없을 때만 생성 | 유지 |
| 병합 | `AGENTS.md`(표식 사이), `CLAUDE.md`, `.gitignore` | 병합 | 병합 |

설정을 처음 상태로 되돌리려면 `config.jsonc` 를 지우고 `init` 을 다시 실행합니다.

## 명령어

```bash
npx specthread init [--tools claude,cursor]   # 프로젝트 초기화
npx specthread init --force                   # 패키지 파일 갱신, 업데이트 프롬프트 출력
npx specthread check                          # 문서 정합성 검사
npx specthread gen                            # 생성 결과 미리보기
npx specthread gen --write                    # 생성 결과 적용
```

### check

30개 규칙으로 문서 형식을 검사합니다. 하위 디렉터리에서 실행해도 `specthread/config.jsonc` 가 있는 디렉터리를 루트로 삼아 같은 범위를 검사합니다.

| 종료 코드 | 의미 |
| --------- | ---- |
| 0 | 지적 없음 |
| 1 | 지적 있음 |
| 2 | 실행 실패 (설정 파일 없음, 설정 오류, 모르는 명령) |

### gen

본문 링크, 헤딩, `pending.md` 항목에서 아래 내용을 생성합니다. `--write` 없이 실행하면 바뀔 파일 목록만 출력합니다.

| 생성 대상 | 내용 | 조건 |
| --------- | ---- | ---- |
| 목차 | 제목 아래 `##` 헤딩 목록 | 항상 |
| 참조 절 | 본문 링크를 대상별로 모은 `## 참조` | `features.references` |
| 미확정 사항 절 | `pending.md` 항목 중 그 문서를 참조하는 것 | `features.markers`, 절이 이미 있는 문서만 |
| 요약 표 | `pending.md` 각 절 첫 부분의 항목 표 | `features.markers` |

꼬리 절(참조 → 미확정 사항 → 변경 이력) 순서가 어긋난 문서는 생성하지 않고 건너뜁니다.

### init --force

`rules.md`, 템플릿, 스킬을 새 버전으로 바꾸고, 남은 정리를 AI 에게 맡길 업데이트 프롬프트를 출력합니다. 프롬프트에는 실행할 때 감지한 항목만 포함됩니다.

| 감지 항목 | 프롬프트 단계 |
| --------- | ------------- |
| 내용이 바뀐 패키지 파일 | git diff 로 사용자 수정분 확인 |
| 표식 없는 이전 형식 `AGENTS.md` | 표식으로 감싼 뒤 `init` 재실행 |
| 끝 표식이 없는 `AGENTS.md` | 끝 표식 추가 후 `init` 재실행 |
| 이전 경로의 스킬 파일 (`.claude/skills/<이름>.md`) | 새 스킬과 비교 후 삭제 |
| 설정 파일의 제거된 키 (주석 포함) | 키 삭제 |
| 사용자 파일의 옛 문구 | 현재 문구로 교체 |
| `path` 에서 빠진 기본 경로 | 의도 확인 |

검사(`check`)와 생성(`gen --write`) 단계는 항상 포함됩니다. Claude Code 에서 `! npx specthread init --force` 로 실행하면 출력이 대화에 바로 포함됩니다.

## 검사 규칙

규칙 ID 는 `<군>/<검사>` 형식입니다. 규칙 본문은 `specthread/rules.md` 에 있고, 각 절에 해당 규칙 ID 가 적혀 있습니다.

| 군 | 수 | 검사 내용 |
| -- | -- | --------- |
| `heading` | 4 | 제목 1개, 꼬리 절 이름·번호·순서 |
| `toc` | 2 | 목차 누락, 헤딩과 불일치 |
| `link` | 2 | 링크 대상 파일, 앵커 |
| `section-ref` | 5 | `§N` 대상 절 존재, 앵커 링크 사용, 문서명 해소 |
| `reference` | 2 | 참조 절 누락, 본문 링크와 불일치 |
| `changelog` | 1 | 변경 이력 날짜 순서 |
| `timestamp` | 1 | 본문의 날짜 |
| `marker` | 3 | 마커와 `pending.md` 항목 대조, 종류 등록 여부 |
| `pending` | 9 | 항목 형식, 시점 표기, 요약 표·미확정 사항 절 최신 여부 |
| `style` | 1 | 코드의 규칙 ID 가 `rules.md` 에 선언됐는지 |

검사를 끄는 방법:

- 기능 단위: `features.markers`, `features.references`
- 경로 단위: `skipCheck`
- 줄 단위: 같은 줄이나 바로 윗줄의 주석에 `@specthread-ignore`

## 설정

`specthread/config.jsonc` 로 프로젝트별 동작을 정합니다. 개인 설정은 `specthread/config.local.jsonc` 에 두고, 이 파일은 `init` 이 `.gitignore` 에 추가합니다.

```
도구 기본값 → specthread/config.jsonc → specthread/config.local.jsonc
```

- 배열과 `path`: 통째로 교체
- 그 밖의 객체: 키 단위 병합
- 잘못된 값: 파일과 키를 출력하고 종료 코드 2
- 제거된 키, 모르는 키: 경고만 출력

| 키 | 역할 | 기본값 |
| -- | ---- | ------ |
| `path` | 스캔 대상 경로 (키는 자유 라벨) | `docs/`, `specthread/` |
| `fileKinds` | 확장자별 파일 종류 (`doc` / `source`) | `doc` 은 `.md`, `source` 는 코드·데이터 확장자 |
| `features` | 기능 켜기·끄기 (`markers`, `references`) | 모두 `true` |
| `markers` | 마커 종류(`types`), 해결 예정 라벨(`timepoints`) | `["system"]`, `[]` |
| `ignoreDocNames` | 절 참조 해소에서 제외할 문서 이름 | `[]` |
| `skipCheck` | 검사·생성을 건너뛸 경로 | `[]` |
| `skipRefs` | 참조 절을 만들지 않을 경로 | `[]` |
| `work` | 작업 문서 폴더 | `docs/work/` |

`init` 이 만드는 `config.jsonc` 에 모든 옵션의 설명이 주석으로 적혀 있습니다. `fileKinds.doc` 에 확장자(예: `.mdx`)를 추가하면 그 파일도 문서로 검사하고 절 참조 대상으로 해소합니다.

`specthread/` 아래 규칙·미확정 사항·프로젝트 문서의 경로는 고정입니다. 템플릿과 설정 파일은 항상 검사에서 제외됩니다.

## 문서 체계

`specthread/rules.md` 가 문서 형식 규칙의 정본입니다. 주요 규칙은 아래와 같습니다.

- 제목 바로 아래 목차
- 본문 절은 `§N-M` 번호 체계, 다른 문서의 절은 앵커 링크로 참조
- 문서 끝 꼬리 절은 참조 → 미확정 사항 → 변경 이력 순서
- 날짜·버전 정보는 본문이 아닌 변경 이력에 기록
- 빈 섹션은 `해당 없음 - <이유>`

### 미확정 사항

작업 중 정하지 못한 것은 작업을 멈추지 않고 마커로 표시합니다. 같은 ID 를 세 곳에서 관리하고, 정본은 `pending.md` 하나입니다.

| 위치 | 표기 | 작성 |
| ---- | ---- | ---- |
| 코드·문서의 발생 지점 | `PENDING::<종류>::<slug>` | 사람 |
| `specthread/pending.md` | `` ### `[<종류>::<slug>]` 제목 `` | 사람 |
| 각 문서의 `## 미확정 사항` | 그 문서를 참조하는 항목 목록 | `gen` |

JSON 처럼 주석을 쓸 수 없는 파일에서는 `"_pending": "<종류>::<slug>"` 필드로 표기합니다. `check` 는 마커와 항목을 양방향으로 대조해서, 항목 없는 마커(`marker/orphan`)와 마커 없는 항목(`marker/unmarked`)을 지적합니다.

## SDD 작업 흐름

```
스펙 확인 → 현황 점검(check) → 계획 수립 → 구현 → 검증(check) → 문서 갱신
```

구현 전에 spec 을 읽고, 구현 후에 spec 을 갱신합니다. 작업 계획은 `docs/work/` 에 plan 문서로 작성하고, 작업이 끝나면 내용을 spec 에 반영한 뒤 plan 문서를 삭제합니다.

### 예시: 기존 인증 spec 에 소셜 로그인 추가

`docs/spec/auth.md` 가 있는 프로젝트에서 소셜 로그인을 추가하는 경우입니다.

```
You: 소셜 로그인 기능 계획 세워줘
AI:  docs/spec/auth.md 확인 후 plan 템플릿으로 docs/work/social-login.md 작성.
     목표, 작업 단계, 영향 파일 포함.
     문서 정합성 검사 통과.
```

```
You: 진행해줘
AI:  작업 단계 1 "OAuth 프로바이더 연동" 구현.
     세션 관리 방식이 미정이라 PENDING::design::oauth-session 마커 추가.
     단계 상태를 "완료"로 갱신.
```

```
You: 전부 끝났어, 정리해줘
AI:  종료 게이트 점검 후 작업 내용을 docs/spec/auth.md §3 에 반영.
     docs/work/social-login.md 삭제.
     문서 정합성 검사 통과.
```

작업이 끝나면 `docs/spec/auth.md` 에 소셜 로그인 절이 추가되고 plan 문서는 삭제됩니다. spec 은 항상 현재 시스템을 설명하는 정본으로 유지됩니다.

## AI 도구 지원

`AGENTS.md` 가 AI 도구의 진입점입니다. 대부분의 AI 코딩 도구가 이 파일을 읽습니다.

| 도구 | 동작 |
| ---- | ---- |
| Claude Code | `CLAUDE.md` 의 `@AGENTS.md` 로 읽음 |
| Cursor / Copilot / Codex / Gemini | `AGENTS.md` 를 직접 읽음 |

`--tools claude`(기본값)로 init 하면 Claude Code 스킬이 함께 설치됩니다.

| 스킬 | 역할 |
| ---- | ---- |
| `/check` | 문서 검사 실행, 결과 해석 |
| `/gen` | 생성 결과 미리보기, 승인 후 적용 |
| `/plan-open` | 작업 계획 문서 작성·검수·확정 |
| `/plan-run` | 계획에 따른 실행과 기록 |
| `/plan-close` | 완료된 작업을 spec 에 반영, plan 문서 삭제 |

스킬 없이 자연어로 요청해도 됩니다. `AGENTS.md` 에 작업 흐름이 적혀 있어서 AI 가 같은 순서로 진행합니다.

## 버전 올리기

```bash
npm install -D specthread@latest
npx specthread init --force
```

출력된 업데이트 프롬프트를 AI 에게 전달하면 AI 가 남은 정리를 진행합니다. `init --force` 는 패키지 파일만 바꾸고 사용자 파일은 그대로 둡니다. `rules.md` 나 템플릿을 직접 고쳐 썼다면, 실행 전에 커밋해 두어야 바뀐 내용을 diff 로 확인할 수 있습니다.

### 0.2.0 에서 바뀐 동작

| 변경 | 영향 |
| ---- | ---- |
| `locale`, `rules`, `pending`, `project`, `features.emDash` 키 제거 | 남아 있으면 경고만 출력 |
| `path` 통째 교체 | 일부 키만 적으면 기본 `docs/`, `specthread/` 스캔이 빠짐 |
| 종료 코드 2 | 설정 파일이 없거나 읽지 못할 때, 모르는 명령일 때 |
| 규칙 추가 | `heading/tail-order`, `marker/unknown-type`, `pending/unknown-timepoint` |
| em dash 검사 제거 | `style/em-dash` 없음 |
| 스킬 경로 | `.claude/skills/<이름>/SKILL.md`. 옛 파일은 지우지 않고 안내 |

## 요구 사항

- Node.js 18 이상
- 외부 의존성 없음

## 라이선스

MIT
