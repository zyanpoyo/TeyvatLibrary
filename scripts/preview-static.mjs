import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".data": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

function parseArgs(argv) {
  let host = "127.0.0.1";
  let port = 4173;
  let dir = "build/client";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--host" && argv[i + 1]) {
      host = argv[++i];
    } else if (arg === "--port" && argv[i + 1]) {
      const parsed = Number(argv[++i]);
      if (Number.isInteger(parsed) && parsed > 0) {
        port = parsed;
      }
    } else if (arg === "--dir" && argv[i + 1]) {
      dir = argv[++i];
    }
  }

  return { host, port, dir };
}

function getContentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || "application/octet-stream";
}

function resolveStaticAsset(rootDir, requestPathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPathname);
  } catch {
    return { status: 400, filePath: null };
  }

  const normalizedRel = decoded.replace(/^\/+/, "");
  const candidate = path.resolve(rootDir, normalizedRel);
  if (candidate !== rootDir && !candidate.startsWith(rootDir + path.sep)) {
    return { status: 403, filePath: null };
  }

  if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
    return { status: 200, filePath: candidate };
  }

  const indexCandidate = path.join(candidate, "index.html");
  if (fs.existsSync(indexCandidate) && fs.statSync(indexCandidate).isFile()) {
    return { status: 200, filePath: indexCandidate };
  }

  const notFoundPage = path.join(rootDir, "404.html");
  if (fs.existsSync(notFoundPage) && fs.statSync(notFoundPage).isFile()) {
    return { status: 404, filePath: notFoundPage };
  }

  return { status: 404, filePath: null };
}

function startStaticServer({ host, port, dir }) {
  const rootDir = path.resolve(process.cwd(), dir);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`配信ディレクトリが見つかりません: ${rootDir}`);
    process.exit(1);
  }

  const server = http.createServer((req, res) => {
    const method = req.method || "GET";
    if (method !== "GET" && method !== "HEAD") {
      res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Method Not Allowed");
      return;
    }

    const reqUrl = new URL(req.url || "/", `http://${host}:${port}`);
    const resolved = resolveStaticAsset(rootDir, reqUrl.pathname);

    if (!resolved.filePath) {
      res.writeHead(resolved.status, { "Content-Type": "text/plain; charset=utf-8" });
      if (method === "HEAD") {
        res.end();
        return;
      }
      res.end(resolved.status === 404 ? "Not Found" : "Invalid Request");
      return;
    }

    const body = fs.readFileSync(resolved.filePath);
    res.writeHead(resolved.status, {
      "Content-Type": getContentType(resolved.filePath),
      "Content-Length": String(body.length),
    });
    if (method === "HEAD") {
      res.end();
      return;
    }
    res.end(body);
  });

  server.listen(port, host, () => {
    console.log(`Static preview server listening at http://${host}:${port} (${rootDir})`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  startStaticServer(parseArgs(process.argv.slice(2)));
}
