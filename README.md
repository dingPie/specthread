# specthread

[![npm](https://img.shields.io/npm/v/specthread)](https://www.npmjs.com/package/specthread) [![license](https://img.shields.io/npm/l/specthread)](https://github.com/dingPie/specthread/blob/main/LICENSE)

스펙 문서에 현재 상태만 남기고, 그 규칙을 코드로 검사하는 Spec-Driven Development(SDD) 도구입니다.

- **현재 상태만 담는 스펙**: 정하지 못한 것은 `pending.md` 로, 지난 이력은 변경 이력과 git 으로 분리. 이 원칙을 14개 규칙으로 검사
- **코드로 하는 검사**: 목차·참조 절은 자동 생성하고, 링크·절 참조를 포함한 30개 규칙을 검사. CI 에서 종료 코드로 판정
- **기본 작업 흐름**: spec·plan 템플릿과 AI 에이전트용 `AGENTS.md`·스킬로 계획 → 구현 → spec 반영

<br />

## 시작하기

```bash
npm install -D specthread
npx specthread init
npx specthread check
```

`init` 이 규칙 문서, 설정, AI 도구용 파일을 만들고 `check` 가 문서를 검사합니다. 지적은 파일과 줄 번호, 규칙 ID 와 함께 출력됩니다.

```
지적 4 건

  docs/spec/auth.md
        3  toc/stale  목차가 헤딩과 어긋난다 - 항목 2 / 헤딩 3
       10  link/target  대상이 없다 - ./session.md
       14  section-ref/unknown-doc  §3 없는 문서를 가리킨다 - api.md
       20  reference/missing  참조 절이 없다 - 본문 링크 1 대상
```

목차와 참조 절처럼 본문에서 만들 수 있는 부분은 `npx specthread gen --write` 로 고칩니다.

<details>
<summary>init 이 만드는 파일</summary>

```
specthread/
  config.jsonc     설정
  rules.md         문서 형식 규칙
  project.md       설정값의 맥락과 근거
  pending.md       미확정 사항 정본
  templates/       spec·plan 문서 골격
AGENTS.md          AI 도구 진입점
CLAUDE.md          @AGENTS.md
.claude/skills/    Claude Code 스킬
```

기존 `AGENTS.md`, `CLAUDE.md` 가 있으면 specthread 내용만 추가합니다.

</details>

새 버전으로 올릴 때는 패키지를 갱신하고 `init --force` 를 실행합니다. 규칙·템플릿·스킬만 새 버전으로 바뀌고, 남은 정리를 위한 프롬프트가 출력됩니다. 이 프롬프트를 AI 에게 그대로 전달하면 됩니다.

```bash
npm install -D specthread@latest
npx specthread init --force
```

<br />

## 명령어

```bash
npx specthread init          # 프로젝트 초기화
npx specthread init --force  # 새 버전으로 갱신
npx specthread check         # 문서 검사
npx specthread gen           # 생성 결과 미리보기
npx specthread gen --write   # 생성 결과 적용
```

- `check`: 지적이 있으면 종료 코드 1, 설정을 읽지 못하면 2
- `gen`: 목차, 참조 절, 미확정 사항 목록 생성. `--write` 없이는 바뀔 파일 목록만 출력
- `init --force`: `config.jsonc`, `project.md`, `pending.md` 는 덮어쓰지 않음

규칙 전체와 규칙 ID 는 [`rules.md`](https://github.com/dingPie/specthread/blob/main/scaffold/rules.md) 에 있습니다. `init` 이 같은 파일을 `specthread/rules.md` 로 설치합니다.

<br />

## 작업 흐름

구현 전에 spec 을 읽고, 구현 후에 spec 을 갱신합니다. 진행 중 정하지 못한 것은 `PENDING::<종류>::<slug>` 마커로 남기고 작업을 계속합니다.

```
You: 소셜 로그인 계획 세워줘
AI:  docs/spec/auth.md 확인 후
     docs/work/social-login.md 작성

You: 진행해줘
AI:  OAuth 연동 구현, 세션 방식은 미정이라
     PENDING::design::oauth-session 마커 추가

You: 정리해줘
AI:  작업 내용을 docs/spec/auth.md 에 반영,
     계획 문서 삭제, check 통과
```

Claude Code 에서는 아래 스킬로 같은 흐름을 실행합니다. 스킬 없이 자연어로 요청해도 `AGENTS.md` 에 적힌 흐름대로 진행합니다.

- `/plan-open`: 작업 계획 문서 작성·확정
- `/plan-run`: 계획에 따른 구현과 기록
- `/plan-close`: 완료된 작업을 spec 에 반영
- `/check`, `/gen`: 검사·생성 실행과 결과 안내

Cursor, Copilot, Codex, Gemini 는 `AGENTS.md` 를 직접 읽습니다. 스킬이 필요 없으면 `init --tools cursor` 처럼 `claude` 를 빼고 실행합니다.

<br />

## 설정

`specthread/config.jsonc` 에서 스캔 경로, 파일 종류, 마커 종류 등을 정합니다. `init` 이 만든 파일에 모든 옵션이 주석으로 설명되어 있습니다.

```jsonc
{
  "path": {
    "docs": ["docs/"],
    "source": ["src/"]
  },
  "markers": {
    "types": ["system", "design"]
  }
}
```

`path` 는 기본값과 합치지 않고 교체되므로 `docs/` 도 함께 적습니다. 개인 설정은 `specthread/config.local.jsonc` 에 둡니다.

<br />

## 요구 사항

- Node.js 18 이상
- 외부 의존성 없음

<br />

## 라이선스

MIT
