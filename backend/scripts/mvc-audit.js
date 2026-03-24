const fs = require("fs");
const path = require("path");

function readAllFiles(dir, predicate = () => true, out = []) {
  if (!fs.existsSync(dir)) {
    return out;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      readAllFiles(fullPath, predicate, out);
      continue;
    }
    if (predicate(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function rel(filePath) {
  return path.relative(process.cwd(), filePath).replace(/\\/g, "/");
}

function containsAny(content, patterns) {
  return patterns.filter((pattern) => pattern.test(content));
}

function addViolation(violations, filePath, message) {
  violations.push(`${rel(filePath)}: ${message}`);
}

function scanLayer(layerDir, fileGlobTest, checks, violations) {
  const files = readAllFiles(layerDir, (f) => fileGlobTest(f));
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    for (const check of checks) {
      const hits = containsAny(content, check.patterns);
      if (hits.length > 0) {
        addViolation(violations, file, check.message);
      }
    }
  }
}

function buildRequireGraph(files) {
  const graph = new Map();
  const fileSet = new Set(files);

  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const imports = [];
    const regex = /require\(("|')(\.\.?\/[^"']+)\1\)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      let target = path.resolve(path.dirname(file), match[2]);
      if (!target.endsWith(".js")) {
        if (fs.existsSync(`${target}.js`)) {
          target = `${target}.js`;
        } else if (fs.existsSync(path.join(target, "index.js"))) {
          target = path.join(target, "index.js");
        } else {
          continue;
        }
      }
      if (fileSet.has(target)) {
        imports.push(target);
      }
    }
    graph.set(file, imports);
  }

  return graph;
}

function detectCycles(graph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];

  function dfs(node) {
    if (visiting.has(node)) {
      const idx = stack.indexOf(node);
      if (idx >= 0) {
        cycles.push([...stack.slice(idx), node]);
      }
      return;
    }
    if (visited.has(node)) {
      return;
    }

    visiting.add(node);
    stack.push(node);
    const nextNodes = graph.get(node) || [];
    for (const next of nextNodes) {
      dfs(next);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }

  for (const node of graph.keys()) {
    dfs(node);
  }

  const unique = new Set();
  const normalized = [];
  for (const cycle of cycles) {
    const relCycle = cycle.map((c) => rel(c));
    const key = relCycle.join(" -> ");
    if (!unique.has(key)) {
      unique.add(key);
      normalized.push(relCycle);
    }
  }

  return normalized;
}

function main() {
  const root = process.cwd();
  const projectRoot = path.resolve(root, "..");
  const backendSrc = path.join(root, "src");
  const controllersDir = path.join(backendSrc, "controllers");
  const servicesDir = path.join(backendSrc, "services");
  const routesDir = path.join(backendSrc, "routes");
  const modelsDir = path.join(backendSrc, "models");
  const viewsJsDir = path.join(projectRoot, "views", "js");
  const pagesDir = path.join(projectRoot, "pages");

  const violations = [];

  scanLayer(
    controllersDir,
    (f) => f.endsWith(".js"),
    [
      {
        patterns: [/\.\.\/models\//, /\.\.\/db\/prisma/, /require\(["']express["']\)/],
        message: "Controller must not import models/db/express directly.",
      },
      {
        patterns: [/db\.[a-zA-Z]/],
        message: "Controller appears to access db delegate directly.",
      },
    ],
    violations,
  );

  scanLayer(
    servicesDir,
    (f) => f.endsWith(".js"),
    [
      {
        patterns: [/\breq\./, /\bres\./, /\bnext\(/, /require\(["']express["']\)/],
        message: "Service must not depend on HTTP/Express objects.",
      },
      {
        patterns: [/\.status\(/, /\.json\(/],
        message: "Service must not format HTTP responses.",
      },
    ],
    violations,
  );

  scanLayer(
    routesDir,
    (f) => f.endsWith(".js"),
    [
      {
        patterns: [/\.\.\/services\//, /\.\.\/models\//, /\.\.\/db\/prisma/],
        message: "Route must not import services/models/db directly.",
      },
      {
        patterns: [/db\.[a-zA-Z]/],
        message: "Route appears to access db delegate directly.",
      },
      {
        patterns: [/require\(["']zod["']\)/, /z\.object\(/],
        message: "Route must not define validation schemas inline; use validators layer.",
      },
    ],
    violations,
  );

  scanLayer(
    modelsDir,
    (f) => f.endsWith(".js"),
    [
      {
        patterns: [/\.\.\/controllers\//, /\.\.\/services\//, /require\(["']express["']\)/],
        message: "Model must not import controllers/services/express.",
      },
      {
        patterns: [/\breq\./, /\bres\./],
        message: "Model must not depend on req/res.",
      },
    ],
    violations,
  );

  scanLayer(
    viewsJsDir,
    (f) => f.endsWith(".js"),
    [
      {
        patterns: [/process\.env/, /JWT_SECRET/, /API_KEY/, /SECRET_KEY/, /sk_live_/, /AKIA[0-9A-Z]{16}/],
        message: "Frontend JS may contain server secret pattern.",
      },
    ],
    violations,
  );

  scanLayer(
    pagesDir,
    (f) => f.endsWith(".html"),
    [
      {
        patterns: [/sk_live_/, /AKIA[0-9A-Z]{16}/, /JWT_SECRET/, /SECRET_KEY/, /API_KEY/],
        message: "Frontend HTML may contain server secret pattern.",
      },
    ],
    violations,
  );

  const backendJsFiles = readAllFiles(backendSrc, (f) => f.endsWith(".js"));
  const graph = buildRequireGraph(backendJsFiles);
  const cycles = detectCycles(graph);
  for (const cycle of cycles) {
    addViolation(violations, path.join(root, "src"), `Circular dependency detected: ${cycle.join(" -> ")}`);
  }

  if (violations.length) {
    console.error("MVC audit failed. Violations found:\n");
    for (const violation of violations) {
      console.error(`- ${violation}`);
    }
    process.exit(1);
  }

  console.log("MVC audit passed: layer boundaries and secret scans are clean.");
}

main();