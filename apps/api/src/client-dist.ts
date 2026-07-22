import fs from "node:fs";
import path from "node:path";

/** Find the built Vite client directory from root, app, or container cwd.
 * 从根目录、API 应用目录或容器工作目录定位 Vite 前端构建产物。 */
export function findClientDist() {
  const candidates = [
    process.env.CLIENT_DIST_PATH,
    path.resolve(process.cwd(), "apps/web/dist"),
    path.resolve(process.cwd(), "../web/dist"),
    path.resolve(process.cwd(), "web/dist"),
  ].filter((candidate): candidate is string => Boolean(candidate));
  return candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "index.html")),
  );
}

/** Read the built SPA entry HTML when available.
 * 读取可用的 SPA 构建入口 HTML。 */
export function readClientIndex(clientDist: string) {
  return fs.readFileSync(path.join(clientDist, "index.html"), "utf8");
}
