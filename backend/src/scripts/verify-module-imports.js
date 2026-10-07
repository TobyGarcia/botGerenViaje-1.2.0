import { access, readdir, readFile } from "node:fs/promises";
import { constants } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const missing = [];

for (const file of await listJavaScriptFiles(sourceRoot)) {
  const source = await readFile(file, "utf8");
  const imports = source.matchAll(/(?:import\s+(?:[^"']+?\s+from\s+)?|export\s+[^"']+?\s+from\s+|import\s*\()["'](\.[^"']+)["']/g);
  for (const match of imports) {
    const target = resolve(dirname(file), match[1]);
    try {
      await access(target, constants.R_OK);
    } catch {
      missing.push(`${file.replace(sourceRoot, "src")}: ${match[1]}`);
    }
  }
}

if (missing.length) {
  console.error("Hay módulos locales ausentes:\n" + missing.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Todos los módulos locales importados existen.");
}

async function listJavaScriptFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await listJavaScriptFiles(path));
    else if (extname(entry.name) === ".js") files.push(path);
  }
  return files;
}
