/**
 * 프로젝트 루트 찾기.
 *
 * 설정 파일이 있는 디렉터리가 루트다. 하위 디렉터리에서 실행해도 같은 범위를 검사한다.
 */
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { CONFIG_PATH } from "../constants/paths.ts";

/** start 에서 위로 올라가며 설정 파일이 있는 디렉터리를 찾는다. 없으면 null */
export const findRoot = (start: string = process.cwd()): string | null => {
  let dir = resolve(start);
  while (!existsSync(join(dir, CONFIG_PATH))) {
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
  return dir;
};
