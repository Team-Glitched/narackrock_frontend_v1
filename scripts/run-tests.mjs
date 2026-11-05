import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

function findTests(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory()
      ? findTests(file)
      : /\.test\.(ts|mjs)$/.test(entry.name)
        ? [file]
        : [];
  });
}

const tests = findTests(path.join(projectRoot, "src")).sort();
if (tests.length === 0) throw new Error("실행할 테스트 파일을 찾지 못했습니다.");

const result = spawnSync(
  process.execPath,
  ["--test", "--experimental-strip-types", "--no-experimental-webstorage", ...tests],
  { cwd: projectRoot, stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
