/**
 * check·gen 공통 시작 - 루트를 찾고 설정을 읽는다. 실패하면 `EXIT.FAILURE` 로 끝낸다.
 */
import { ConfigError, loadConfig } from "../config-loader.ts";
import type { SpecthreadConfig } from "../config.schema.ts";
import { EXIT } from "../constants/exit.ts";
import { CONFIG_PATH } from "../constants/paths.ts";
import { findRoot } from "../utils/root.ts";

export const openProject = (): { root: string; config: SpecthreadConfig } => {
  const root = findRoot();
  if (root === null) {
    console.error(`[specthread] ${CONFIG_PATH} 를 찾지 못했다. 프로젝트 루트에서 \`specthread init\` 을 먼저 실행한다`);
    process.exit(EXIT.FAILURE);
  }

  try {
    return { root, config: loadConfig(root) };
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    console.error("[specthread] 설정을 읽지 못했다");
    for (const p of e.problems) {
      console.error(`  ${p.file}${p.key === "" ? "" : ` ${p.key}`}: ${p.message}`);
    }
    process.exit(EXIT.FAILURE);
  }
};
