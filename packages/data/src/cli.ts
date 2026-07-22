import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshDataPipeline } from "./pipeline.js";

const rootDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

async function main() {
  const result = await refreshDataPipeline({ rootDir });
  console.log(JSON.stringify(result));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
