# specthread (패키지 개발)

npm 패키지 `specthread` 소스 레포. SDD(Spec-Driven Development) 검사/생성 도구.

## 구조

| 경로 | 역할 |
|------|------|
| `tools/docs/` | 도구 소스 (검사기, 생성기, 파서, CLI) |
| `scaffold/` | `specthread init` 이 복사하는 템플릿 |
| `tools/hooks/` | Git hook 스크립트 |
| `dist/` | 빌드 출력 (gitignore) |

## 개발

```bash
npm run docs:typecheck   # 타입 검사
npm run docs:test        # 유닛 테스트 (74건)
npm run build            # tsc 빌드
npm run docs:check       # 실 문서 대상 정합성 검사 (scaffold 기반)
```

## 배포

```bash
npm run release:patch    # patch 버전 범프 + publish
npm run release:minor    # minor 버전 범프 + publish
```

## 컨벤션

- 함수 표현식 (`const fn = () =>`) 사용. `function` 선언문 금지.
- 객체 타입은 `interface`. `type` alias는 union 등 interface 불가 시에만.
- `FileKind`: `"doc" | "source"`. 확장자 매핑은 `config.fileKinds` 기반.
- 검사 규칙 ID: `<군>/<검사>` 형태. `checks/<군>.ts` 와 대응.
