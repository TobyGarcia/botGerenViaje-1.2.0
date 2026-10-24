import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const tests = readdirSync(new URL("./", import.meta.url)).filter(name => name.endsWith(".test.js") && name !== "operation-audit.test.js");
for (const args of [
  ["--import", "./src/tests/support/isolated-database.js", "--test", "--test-concurrency=2", ...tests.map(name => "./src/tests/" + name)],
  ["--test", "./src/tests/operation-audit.test.js"]
]) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit", cwd: new URL("../../", import.meta.url) });
  if (result.status !== 0) process.exit(result.status || 1);
}
