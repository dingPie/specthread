# Specthread - 설계 문서

**목차**

- [1. 아키텍처](#1-아키텍처)
- [2. 설정 파일](#2-설정-파일)
- [3. AGENTS.md 범위](#3-agentsmd-범위)
- [4. 도구 주입 인터페이스](#4-도구-주입-인터페이스)
- [5. 배포 방식](#5-배포-방식)
- [6. 사용 인터페이스](#6-사용-인터페이스)
- [7. 산업 패턴 참조](#7-산업-패턴-참조)
- [8. 작업 순서](#8-작업-순서)
- [9. 미결 사항](#9-미결-사항)

note-rpg에서 추출하는 SDD(Spec-Driven Development) 템플릿.
문서 규칙 + 검사/생성 도구 + AI 협업 규약을 하나의 재사용 가능한 구조로 제공한다.

---

## 1. 아키텍처

### 1-1. 3-Layer 분리

```
Core (고정)  →  Project (tracked JSON)  →  Personal (.gitignored JSON)
```

| Layer    | 파일                             | 역할                               |
| -------- | -------------------------------- | ---------------------------------- |
| Core     | AGENTS.md, rules.md, 도구 코드   | 도구가 의존하는 고정 구조          |
| Project  | `specthread.config.jsonc`       | 프로젝트별 경로, 기능 플래그, 마커 |
| Personal | `specthread.config.local.jsonc` | 개인 오버라이드 (.gitignored)      |

**판별 기준**: "이 규칙을 빼도 도구가 돌아가고, 문서 체계가 유지되는가?" → Yes면 코어 아님.

참고: Spec Kit 4-layer(defaults → project → local → env)에서 착안. CI env layer는 불필요하여 3-layer로 축소.

### 1-2. AI 도구 비종속

specthread의 실제 가치는 문서 체계 + 도구이며, 특정 AI 도구에 종속되지 않는다.
AI 도구에 종속되는 건 오직 "이 체계를 AI에게 어떻게 알려줄 것인가" 부분뿐이다.

**AGENTS.md를 본체(진입점)로 사용한다.**

- 업계 표준: 60,000+ 오픈소스 레포 채택, 20+ AI 도구가 네이티브 지원
- Claude Code, Cursor, Copilot, Codex, Gemini, Kiro 전부 AGENTS.md를 읽음
- LeanSpec, OpenSpec, BMAD, Spec Kit 전부 AGENTS.md 기반

도구별 파일(CLAUDE.md, .cursorrules 등)은 AGENTS.md를 참조하는 **얇은 셸**이다.

### 1-3. 진입점 계층

```
CLAUDE.md (사용자 소유, 얇은 셸)
  └── @AGENTS.md (1줄 import)

AGENTS.md (코어 소유, 진입점 본체)
  ├── SDD 워크플로우
  ├── 도구 명령어 (check/gen)
  ├── 설정 라우팅 → specthread.config.jsonc
  └── 문서 체계 참조 → rules.md, project.md
```

**왜 CLAUDE.md에 직접 넣지 않는가**:

- 사용자의 CLAUDE.md는 이미 자신의 규칙으로 차 있다. specthread 규칙을 직접 넣으면 충돌하거나, 무거워져서 사용자가 삭제한다
- "이 파일을 읽어라"라는 텍스트 지시는 **실행되지 않는다**. `@path` import 구문만 자동 확장됨
- AGENTS.md에 본체를 두면 다른 AI 도구 사용자는 추가 설정 없이 바로 사용 가능

**AI 도구별 동작**:

| 사용자          | 동작                                                     |
| --------------- | -------------------------------------------------------- |
| Claude Code     | CLAUDE.md의 `@AGENTS.md`가 세션 시작 시 자동 인라인 확장 |
| Cursor          | AGENTS.md를 네이티브로 직접 읽음                         |
| Copilot / Codex | AGENTS.md를 네이티브로 직접 읽음                         |
| Gemini          | AGENTS.md를 네이티브로 직접 읽음                         |
| Kiro            | AGENTS.md를 네이티브 지원                                |

### 1-4. 목표 구조

```
specthread/
├── AGENTS.md                      ← 진입점 본체 (Core). 모든 AI 도구가 읽음
├── CLAUDE.md                      ← Claude Code용 셸 (사용자 소유)
│                                     @AGENTS.md + 사용자 자신의 규칙
├── specthread.config.jsonc       ← Project 설정 (tracked, 주석=문서)
├── specthread.config.local.jsonc ← Personal 오버라이드 (.gitignored)
├── docs/
│   ├── system/
│   │   ├── rules.md               ← 코어 규칙 (Core, 고정)
│   │   └── project.md             ← 프로젝트 컨텍스트 (설정값의 "왜"를 설명)
│   └── template/
│       ├── spec.md
│       └── plan.md
├── tools/docs/                    ← check/gen 도구 (config.jsonc에서 로드)
├── .claude/
│   ├── skills/                    ← 편의 레이어 (없어도 동작)
│   └── settings.json
└── config/
    ├── style.example.md           ← Personal 설정 예시
    ├── delegation.example.md
    └── constraints.example.md
```

---

## 2. 설정 파일

### 2-1. 형식: JSONC

조사한 15개 도구(Terraform, commitlint, Grit, Spec Kit, Kiro, LeanSpec 등) 전부 "도구가 읽는 설정"과 "사람이 읽는 문서"를 분리한다. enum 값(마커 종류 등)은 예외 없이 설정 파일 안에서 정의.

**JSONC 채택**: `specthread.config.jsonc` - `init`이 생성하는 파일 자체가 문서 역할을 하도록 주석을 포함한다.

- tsconfig.json, .eslintrc.json 등이 동일한 패턴을 사용
- 파싱: `strip-json-comments` (2KB, ESLint 방식) - 주석 제거 후 `JSON.parse()`
- TypeScript는 자체 내장, VS Code는 `jsonc-parser` (4KB) 사용. specthread는 config 하나 읽는 수준이므로 경량 스트립이면 충분

### 2-2. config.jsonc 스키마

`init`이 생성하는 초기 파일. 주석이 곧 문서이다.

```jsonc
{
  // ── 스캔 대상 ──────────────────────────────────────
  // 키는 자유 라벨, 값은 경로 배열.
  // 디렉터리면 재귀 스캔, 파일이면 직접 로드. 파싱은 확장자로 결정.
  "path": {
    "docs": ["docs/"],
    // "source": ["client/src/"],
    // "data": ["data/"],
    // "meta": ["AGENTS.md"]
  },

  // ── 기능 플래그 ────────────────────────────────────
  // false로 끄면 관련 검사 + 생성 모두 비활성화.
  "features": {
    "markers": true, // 마커 체계 (pending 추적 포함)
    "emDash": true, // em dash 검사/치환
    "references": true, // 참조 절 자동 생성
  },

  // ── 마커 체계 ──────────────────────────────────────
  "markers": {
    "types": ["system"], // "system"은 코어 예약. 프로젝트별 추가: "design", "balance" 등
    "timepoints": [], // 마일스톤 라벨: "M1", "M2" 등
  },

  // ── 문서 유형 ──────────────────────────────────────
  "docTypes": {},
  // 예:
  // "docTypes": {
  //   "spec": {
  //     "path": "docs/spec/",
  //     "template": "docs/template/spec.md",
  //     "frontmatter": { "required": ["status", "created"], "optional": ["priority"] }
  //   }
  // },

  // ── 검사 제어 ──────────────────────────────────────
  "ignoreDocNames": [], // 문서명 해소 시 무시할 단어. 예: ["spec"]
  "skipCheck": [], // 규칙 검사 건너뛸 경로 (색인에는 포함)
  "skipRefs": [], // 참조 절 생성 건너뛸 경로

  "locale": "ko",

  // ── 규약 경로 (도구 내부 관리) ──────────────────────
  // 아래는 도구가 직접 사용하는 경로. path와 별개.
  // 기본값 그대로 쓸 경우 생략 가능.
  // "rules": "docs/system/rules.md",
  // "pending": "docs/system/pending.md",
  // "project": "docs/system/project.md",
  // "work": "docs/work/"
}
```

### 2-3. 규약 경로 vs 스캔 경로

| 구분                      | 예시                              | 설명                                         |
| ------------------------- | --------------------------------- | -------------------------------------------- |
| **스캔 경로** (`path`)    | `docs/`, `src/`                   | 사용자가 도구에게 검사해달라고 넘기는 대상   |
| **규약 경로** (도구 내부) | `rules.md`, `pending.md`, `work/` | 도구가 직접 읽고/쓰는 내부 파일. 용도가 고정 |

`path`에 `docs/`를 넣어도 `docs/system/rules.md`는 "검사 대상"이 아니라 "규칙 소스"로 처리된다. 도구가 경로를 보고 역할을 구분한다.

규약 경로는 `SpecthreadConfig`의 required 필드이며 `DEFAULT_CONFIG`에 기본값이 있다. config.jsonc에서 생략하면 기본값이 쓰이고, 명시하면 오버라이드된다.

### 2-4. 기능 플래그 vs 개별 규칙 레벨

현재 도구의 28개 규칙은 대부분 하나의 목적(참조 정합성)을 위해 협력한다.
heading-hierarchy가 깨지면 section 참조가 깨지고, marker-format이 틀리면 pending 추적이 깨진다.

ESLint/Grit처럼 규칙이 독립적인 도구에서는 개별 4-level(error/warn/info/none)이 맞지만,
specthread의 규칙은 **연쇄 의존**이 있으므로 **기능 단위 플래그**가 더 안전하다.

```jsonc
{
  "features": {
    "markers": true, // false → 규칙 4,5,13 + pending 추적 전부 비활성화
    "emDash": true, // false → em dash 검사/훅 비활성화
    "references": true, // false → 참조 생성 스킵
  },
}
```

tsconfig의 `strict`, `noImplicitAny`와 같은 모델.
나중에 독립적 규칙이 늘어나면 그때 개별 레벨을 추가해도 늦지 않다.

### 2-5. 설정 로드 우선순위

```
Core defaults (도구 코드 내 기본값)
  ↓ deep merge
specthread.config.jsonc (Project)
  ↓ deep merge
specthread.config.local.jsonc (Personal, .gitignored)
```

파싱: `strip-json-comments`로 주석 제거 → `JSON.parse()` → deep merge.

---

## 3. AGENTS.md 범위

AGENTS.md는 specthread의 AI 지시 본체이다.
모든 AI 도구가 이 파일을 읽으므로, 도구 비종속적인 내용만 담는다.

### 코어 (고정)

| 항목                | 이유                                        |
| ------------------- | ------------------------------------------- |
| Spec 단일 진실 원천 | SDD 체계의 핵심. 도구가 이 전제 위에서 동작 |
| 마커 체계 참조      | check/gen 파싱과 검증이 의존                |
| 문서 작성 컨벤션    | 규칙 검사 도구의 기대 형식                  |
| SDD 작업 흐름       | 템플릿의 존재 이유                          |
| 도구 명령어         | check/gen 실행 방법                         |
| 설정 파일 라우팅    | "설정은 config.jsonc 참조"                  |
| 개인 설정 슬롯 안내 | config.local.jsonc, config/\*.example.md    |

### 코어 밖 (Personal layer)

코드 주석 정책, AI 위임/결정 분리, 문체 정책(em dash 외), 갈아엎기 방지 원칙,
Portable JSON 4원칙, 콘텐츠 락 - 전부 도구 의존 없음.

### CLAUDE.md의 역할

CLAUDE.md는 **사용자 소유 파일**이다. specthread가 요구하는 건 한 줄뿐:

```markdown
@AGENTS.md
```

나머지 영역은 사용자가 자유롭게 자신의 규칙을 작성한다.
init 시 생성되는 CLAUDE.md 예시:

```markdown
@AGENTS.md

# My Rules

(여기에 자유롭게 추가)
```

### SDD 작업 흐름 (AGENTS.md에 포함)

```
1. 스펙 확인 → 2. 현황 점검(check) → 3. 계획 수립 → 4. 구현 → 5. 검증(check) → 6. 문서 갱신
```

---

## 4. 도구 주입 인터페이스

### 4-1. note-rpg 하드코딩 → config 주입 (완료)

| note-rpg 하드코딩                    | specthread                                  |
| ------------------------------------ | -------------------------------------------- |
| `TARGETS` (scan.ts)                  | `config.path` KV에서 구성                    |
| `DOC.PENDING`, `DOC.RULES` (docs.ts) | `DEFAULT_CONFIG` 규약 경로 (`rules`, `pending`, `project`, `work`) |
| `NOT_CHECKED`, `WORK_DIR`, `WORK_KEPT_RULES` | `config.skipCheck` (`string \| SkipCheckEntry`)[] |
| `AUTO_LOADED` (docs.ts)              | `config.skipRefs`                            |
| `MARKER_EXAMPLES`, `MARKERLESS_ITEMS`, `UNRESOLVED` | 인라인 억제 (`@specthread-ignore`)  |
| 규칙 28개 항상 실행                  | `config.features`로 기능 단위 on/off         |
| `STEM_DENYLIST` (resolve.ts)         | `config.ignoreDocNames`                      |

현재 구조:

```
config-loader.ts     → config.jsonc + config.local.jsonc deep merge (strip-json-comments)
config.schema.ts     → SpecthreadConfig 타입 + DEFAULT_CONFIG
constants/docs.ts    → TAIL_NAMES만 잔류 (locale 의존)
constants/rules.ts   → 규칙 ID 정의 + RuleGroup 자동 파생
utils/scope.ts       → config 기반 정책 판정 (isCheckTarget, isWorkExempt, wantsRefSection)
utils/ignore.ts      → 인라인 억제 파서 (@specthread-ignore)
utils/scan.ts        → config.path 기반 색인 조립
```

### 4-2. 인라인 억제

설정 파일에 예외 목록을 두지 않고, 코드/문서 안에서 직접 억제한다 (eslint-disable 모델).

| 파일 유형 | 방식 | 예시 |
|-----------|------|------|
| MD | 주석 | `<!-- @specthread-ignore -->` |
| TS/JS | 주석 | `// @specthread-ignore` |
| JSON | `_meta` 키 (후순위) | `"_meta": { "ignore": [...] }` |

이전 exceptions 블록 항목들의 이전:
- `markerExamples` → 마커 예시 줄에 `@specthread-ignore`
- `markerlessItems` → pending.md 항목에 `@specthread-ignore`
- `unresolved` → 코드의 절 참조 줄에 `@specthread-ignore`

세분화(`@specthread-ignore:rule-id`)는 추후.

---

## 5. 배포 방식

### 5-1. 설계 원칙

- **"skill 없이도 config.jsonc 직접 편집 + CLI 직접 실행으로 완전히 동작한다."** skill은 편의 레이어이지, 의존성이 아니다.
- **AI 도구 비종속.** AGENTS.md가 본체이므로 Claude Code가 아닌 도구 사용자도 동일하게 사용.

### 5-2. 단계별 로드맵

| 단계        | 형태                                  | 상태                                 |
| ----------- | ------------------------------------- | ------------------------------------ |
| **Phase 0** | 로컬 폴더 복사                        | 현재. 설계 검증                      |
| **Phase 1** | GitHub Template Repo                  | 공개. 다른 사용자가 복사해서 사용    |
| **Phase 2** | npm 패키지 (`@specthread/tools`)     | `init`/`check`/`gen`/`update` CLI    |
| **Phase 3** | Claude Code Plugin + 멀티 도구 어댑터 | skills/hooks 자동 배포, 마켓플레이스 |

Phase 2의 핵심: Spec Kit의 **manifest-aware update** - SHA로 파일 수정 여부를 추적, 사용자가 수정하지 않은 코어 파일만 자동 교체.

### 5-3. Phase 전환: 템플릿 → npm 패키지

Phase 1→2에서 달라지는 건 **도구 코드의 위치**뿐이다. 설정·문서·규약 구조는 동일.

```
Phase 1 (템플릿 복사)              Phase 2 (npm 패키지)
─────────────────────              ─────────────────────
my-project/                        my-project/
├── tools/docs/        ← 복사됨    ├── node_modules/
│   ├── bin/check.ts               │   └── @specthread/tools/  ← npm 관리
│   └── config-loader.ts           │       ├── bin/check.ts
├── specthread.config.jsonc       │       └── config-loader.ts
├── docs/system/                   ├── specthread.config.jsonc  ← 동일
│   ├── rules.md                   ├── docs/system/              ← 동일
│   └── pending.md                 │   ├── rules.md
└── AGENTS.md                      │   └── pending.md
                                   └── AGENTS.md                 ← 동일

실행: npx tsx tools/docs/bin/check.ts    실행: specthread check
```

config-loader가 "cwd에서 config.jsonc를 찾는다"로 구현되면, 도구가 `tools/docs/`에 있든 `node_modules/`에 있든 동일하게 동작한다. 따라서 Phase 1 설계를 그대로 Phase 2로 가져갈 수 있고, 구조 변경이 필요 없다.

### 5-4. 파일 소유권: 코어 vs 스캐폴드

| 파일                       | 성격         | `init`                    | `update`                 |
| -------------------------- | ------------ | ------------------------- | ------------------------ |
| `AGENTS.md`                | **코어**     | 생성                      | SHA 비교 후 갱신 가능    |
| `docs/system/rules.md`     | **코어**     | 생성                      | SHA 비교 후 갱신 가능    |
| `docs/template/*.md`       | **코어**     | 생성                      | SHA 비교 후 갱신 가능    |
| `docs/system/pending.md`   | **스캐폴드** | 빈 파일 생성              | 안 건드림                |
| `docs/system/project.md`   | **스캐폴드** | 템플릿에서 생성           | 안 건드림                |
| `docs/work/`               | **스캐폴드** | 디렉터리 생성             | 안 건드림                |
| `specthread.config.jsonc` | **스캐폴드** | 주석 포함 초기 파일 생성  | 안 건드림                |
| `CLAUDE.md`                | **사용자**   | `@AGENTS.md` 한 줄로 생성 | 안 건드림                |
| `tools/docs/` (Phase 1)    | **코어**     | 복사                      | Phase 2에서 npm으로 대체 |

- **코어**: `update`가 SHA 비교로 관리. 사용자가 안 고쳤으면 새 버전으로 교체
- **스캐폴드**: `init`이 한 번 만들고 끝. 이후 완전히 사용자 소유
- **사용자**: specthread가 전혀 건드리지 않음

### 5-5. 멀티 AI 도구 init

```bash
specthread init                    # 기본: AGENTS.md + CLAUDE.md 생성
specthread init --tools cursor     # AGENTS.md + .cursor/rules/specthread.mdc
specthread init --tools copilot    # AGENTS.md (Copilot은 네이티브 인식)
```

---

## 6. 사용 인터페이스

### 6-1. 3계층 인터페이스

| 계층            | 역할                        | 예시                                  |
| --------------- | --------------------------- | ------------------------------------- |
| **Passive**     | 자동 동작, 사용자 개입 없음 | AGENTS.md 자동 로드, PostToolUse hook |
| **Active**      | 사용자가 명시적 호출        | CLI 명령, 슬래시 커맨드               |
| **Interactive** | 대화형 워크플로우           | init 가이드, plan-work 흐름           |

### 6-2. CLI (Phase 2)

```bash
specthread init       # 프로젝트 초기화 (config.jsonc + AGENTS.md + 규약 파일 생성)
specthread check      # 문서 정합성 검사
specthread gen        # 참조/요약 생성
specthread update     # 코어 파일 업데이트 (manifest-aware)
specthread doctor     # 설정 검증 + 문제 진단
```

### 6-3. Skills (Phase 3, 편의 레이어)

```
/specthread:init        # 대화형 설정 생성 가이드
/specthread:check       # 검사 실행 + AI 해석
/specthread:gen         # 생성 실행 + AI 해석
/specthread:plan-work   # SDD 작업 흐름 가이드
/specthread:help        # 사용 가능한 명령 안내
```

skill이 하는 일은 "config.jsonc 읽기 → CLI 실행 → 결과 해석".
없어도 사용자가 직접 config.jsonc 편집 + CLI 실행으로 동일한 결과를 얻는다.

### 6-4. Hooks (Passive)

```jsonc
{
  "PostToolUse": [
    {
      "matcher": "Write|Edit",
      "hooks": [
        {
          "type": "command",
          "command": "specthread check --quick --file \"$CLAUDE_FILE_PATH\"",
        },
      ],
    },
  ],
}
```

---

## 7. 산업 패턴 참조

| 패턴                     | 출처                                  | 적용                                  |
| ------------------------ | ------------------------------------- | ------------------------------------- |
| AGENTS.md 단일 진실 원천 | 업계 표준 (60K+ 레포, 20+ 도구)       | AGENTS.md를 본체, CLAUDE.md는 셸      |
| @import 인라인 확장      | Claude Code                           | CLAUDE.md에서 `@AGENTS.md` 한 줄      |
| 심볼릭 링크 / 어댑터     | LeanSpec, OpenSpec                    | 멀티 AI 도구 지원 (Phase 3)           |
| 형태/값 분리             | Terraform (variables.tf + tfvars)     | 규칙 정의는 코어, 설정은 config       |
| JSONC 주석 설정          | tsconfig.json, .eslintrc.json         | config.jsonc + strip-json-comments    |
| 인라인 억제              | eslint-disable                        | `@specthread-ignore`                 |
| 기능 플래그              | tsconfig (strict, noImplicitAny)      | `features.markers`, `features.emDash` |
| 3-layer 우선순위         | Spec Kit (defaults → project → local) | core → project → personal             |
| .gitignored local        | Spec Kit (config.local.yml)           | config.local.jsonc                    |
| manifest-aware update    | Spec Kit, BMAD (SHA256 추적)          | Phase 2 update 명령                   |
| CLI + slash command      | Spec Kit, OpenSpec, BMAD              | CLI(도구) + skill(AI 편의)            |
| frontmatter 스키마       | LeanSpec (required/optional)          | docTypes 설정                         |
| scaffold + TODO 마커     | Kiro (create-kiro-project)            | init 시 커스텀 지점 표시              |
| plugin 번들링            | Claude Code Plugin (skills+hooks+bin) | Phase 3                               |

---

## 8. 작업 순서

| #   | 작업               | 내용                                                 | 의존 | 상태 |
| --- | ------------------ | ---------------------------------------------------- | ---- | ---- |
| 1   | config 스키마 확정 | TypeScript interface 정의                            | -    | 완료 |
| 2   | config-loader 구현 | JSONC 파싱 + deep merge, 기본값 처리                 | 1    | 완료 |
| 3   | 도구 코드 리팩토링 | constants/ 하드코딩 → config-loader 주입             | 2    | 완료 |
| 4   | 문서 마이그레이션  | rules.md 정제, project.md 재작성, AGENTS.md 작성     | 1    | 완료 |
| 5   | 검증               | note-rpg 교차 검증                                   | 3, 4 | 건너뜀 |
| 6   | skills 구조        | check, gen, plan-open/run/close                      | 3    | 완료 |
| 7   | template repo 공개 | README, .gitignore                                   | 3    | 완료 |

**1-4, 6-7 완료.** Phase 1 (템플릿 레포) 기본안 완성.

---

## 9. 미결 사항

- [ ] note-rpg 교차 검증 (step 5) - note-rpg에서 config.jsonc 작성 후 기존 출력과 동일 확인
- [ ] 문서 유형(Spec/Plan/Common/Rule) 4종이 코어인지 커스텀인지
- [ ] i18n 전략: `TAIL_NAMES` 등 한국어 키워드 처리 방식 (후순위)
- [ ] `@specthread-ignore:rule-id` 세분화 (후순위)
- [ ] `@specthread-ignore` TS/JS, JSON 지원 (현재 MD만 구현)
- [ ] `skipCheck.except` (특정 군만 스킵) - `only`의 반대. 필요 시 호환성 깨지 않고 추가 가능
- [ ] Phase 3 plugin.json 매니페스트 + 멀티 도구 어댑터 설계
