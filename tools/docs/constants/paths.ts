/**
 * 규약 경로 - 도구가 직접 읽고 쓰는 파일의 위치.
 *
 * 설정으로 열어 두지 않는다. init·스킬·AGENTS.md 가 모두 이 위치를 전제한다.
 */

export const SPECTHREAD_DIR = "specthread";

export const CONFIG_PATH = `${SPECTHREAD_DIR}/config.jsonc`;
export const LOCAL_CONFIG_PATH = `${SPECTHREAD_DIR}/config.local.jsonc`;

/** 규칙 문서 */
export const RULES_PATH = `${SPECTHREAD_DIR}/rules.md`;
/** 미확정 사항 정본 */
export const PENDING_PATH = `${SPECTHREAD_DIR}/pending.md`;
/** 프로젝트 맥락 문서 */
export const PROJECT_PATH = `${SPECTHREAD_DIR}/project.md`;
/** 문서 템플릿 폴더 */
export const TEMPLATES_DIR = `${SPECTHREAD_DIR}/templates`;

/** `path` 와 관계없이 항상 색인한다. 이 파일들을 읽는 검사가 스캔 범위에 좌우되지 않게 한다 */
export const CONVENTION_FILES = [RULES_PATH, PENDING_PATH, PROJECT_PATH] as const;

/**
 * 항상 검사·생성에서 뺀다. 색인에는 남는다.
 *
 * 템플릿과 설정 파일은 예시를 담는다. `skipCheck` 배열은 덮어쓰기라 사용자가 하나만 적어도
 * 기본값이 사라지므로, 그 배열에 넣지 않고 코드가 항상 더한다.
 */
export const DEFAULT_EXCLUDES = [TEMPLATES_DIR, CONFIG_PATH, LOCAL_CONFIG_PATH] as const;
