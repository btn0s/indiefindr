#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const USAGE = `Usage: node scripts/no-prose.mjs [--all | --fix | --install] [paths...]
  (no flag)  check the files staged for commit (the pre-commit hook)
  --all      check every tracked file (pnpm lint)
  --fix      remove the comments from every tracked file, or from the given paths
  --install  point git at .githooks so every commit is checked (pnpm install)`;

const DOC = "AGENTS.md";
const VENDORED = [/^\.agents\//, /(^|\/)pnpm-lock\.yaml$/, /(^|\/)uv\.lock$/];

const scanString = (text, i, quote, to = text.length) => {
  for (i++; i < to && text[i] !== quote; i++) if (text[i] === "\\") i++;
  return i + 1;
};

function scriptComments(text, path, offset = 0) {
  const kind = /x$/.test(path) ? ts.ScriptKind.TSX : /\.[cm]?js$|\.html$/.test(path) ? ts.ScriptKind.JS : ts.ScriptKind.TS;
  const file = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
  const found = new Map();
  const visit = node => {
    if (node.kind >= ts.SyntaxKind.FirstJSDocNode && node.kind <= ts.SyntaxKind.LastJSDocNode) return;
    if (ts.isJsxExpression(node) && !node.expression && /\/[/*]/.test(node.getText(file))) {
      found.set(node.getStart(file), node.end);
      return;
    }
    if (node.kind !== ts.SyntaxKind.JsxText)
      for (const range of [...(ts.getLeadingCommentRanges(text, node.pos) ?? []), ...(ts.getTrailingCommentRanges(text, node.end) ?? [])])
        if (!found.has(range.pos)) found.set(range.pos, range.end);
    for (const child of node.getChildren(file)) visit(child);
  };
  visit(file);
  return [...found].map(([start, end]) => ({ start: start + offset, end: end + offset }));
}

function cssComments(text, from = 0, to = text.length) {
  const found = [];
  for (let i = from; i < to;) {
    if (text[i] === '"' || text[i] === "'") i = scanString(text, i, text[i], to);
    else if (text.startsWith("/*", i)) {
      const close = text.indexOf("*/", i + 2);
      const end = close < 0 || close > to ? to : close + 2;
      found.push({ start: i, end });
      i = end;
    } else i++;
  }
  return found;
}

function sqlComments(text, from = 0, to = text.length, found = []) {
  for (let i = from; i < to;) {
    const two = text.slice(i, i + 2);
    if (two === "--") {
      const newline = text.indexOf("\n", i);
      const end = newline < 0 || newline > to ? to : newline;
      found.push({ start: i, end });
      i = end;
    } else if (two === "/*") {
      let depth = 1, j = i + 2;
      while (j < to && depth) {
        if (text.startsWith("/*", j)) { depth++; j += 2; }
        else if (text.startsWith("*/", j)) { depth--; j += 2; }
        else j++;
      }
      found.push({ start: i, end: j });
      i = j;
    } else if (text[i] === "'") {
      const backslashes = /[eE]/.test(text[i - 1] ?? "") && !/[\w$]/.test(text[i - 2] ?? "");
      for (i++; i < to; i++) {
        if (backslashes && text[i] === "\\") { i++; continue; }
        if (text[i] === "'") { if (text[i + 1] === "'") { i++; continue; } break; }
      }
      i++;
    } else if (text[i] === '"') {
      for (i++; i < to; i++) if (text[i] === '"') { if (text[i + 1] === '"') { i++; continue; } break; }
      i++;
    } else if (text[i] === "$" && !/[\w$]/.test(text[i - 1] ?? "")) {
      const tag = /^\$(?:[A-Za-z_]\w*)?\$/.exec(text.slice(i, i + 64))?.[0];
      if (!tag) { i++; continue; }
      const close = text.indexOf(tag, i + tag.length);
      const end = close < 0 || close > to ? to : close;
      sqlComments(text, i + tag.length, end, found);
      i = end + tag.length;
    } else i++;
  }
  return found;
}

function markupComments(text, path) {
  const found = [];
  for (const match of text.matchAll(/<!--[\s\S]*?-->/g)) found.push({ start: match.index, end: match.index + match[0].length });
  if (!path.endsWith(".html")) return found;
  for (const match of text.matchAll(/(<style[^>]*>)([\s\S]*?)<\/style>/gi)) {
    const from = match.index + match[1].length;
    found.push(...cssComments(text, from, from + match[2].length));
  }
  for (const match of text.matchAll(/(<script[^>]*>)([\s\S]*?)<\/script>/gi)) found.push(...scriptComments(match[2], path, match.index + match[1].length));
  return found;
}

function hashComments(text, { quotes, heredocs = false, wordStart }) {
  const found = [];
  let i = text.startsWith("#!") ? text.indexOf("\n") : 0;
  if (i < 0) return found;
  const pending = [];
  while (i < text.length) {
    const c = text[i];
    if (c === "\n" && pending.length) {
      let at = i + 1;
      for (const { tag, tabs } of pending.splice(0)) {
        for (;;) {
          const newline = text.indexOf("\n", at);
          const line = text.slice(at, newline < 0 ? text.length : newline);
          at = newline < 0 ? text.length : newline + 1;
          if ((tabs ? line.replace(/^\t+/, "") : line) === tag || newline < 0) break;
        }
      }
      i = at;
      continue;
    }
    if (quotes.includes(c)) {
      const triple = c.repeat(3);
      if (quotes === "\"'" && text.startsWith(triple, i) && !heredocs) {
        const close = text.indexOf(triple, i + 3);
        i = close < 0 ? text.length : close + 3;
      } else if (c === "'" && heredocs) {
        const close = text.indexOf("'", i + 1);
        i = close < 0 ? text.length : close + 1;
      } else i = scanString(text, i, c);
      continue;
    }
    if (heredocs && c === "\\") { i += 2; continue; }
    if (heredocs && text.startsWith("<<", i) && text[i + 2] !== "<") {
      const match = /^<<(-?)\s*(['"]?)([\w.-]+)\2/.exec(text.slice(i, i + 80));
      if (match) { pending.push({ tag: match[3], tabs: match[1] === "-" }); i += match[0].length; continue; }
    }
    if (c === "#" && (i === 0 || wordStart.test(text[i - 1]))) {
      const newline = text.indexOf("\n", i);
      const end = newline < 0 ? text.length : newline;
      found.push({ start: i, end });
      i = end;
      continue;
    }
    i++;
  }
  return found;
}

function lineComments(text) {
  const found = [];
  for (const match of text.matchAll(/^#.*$/gm)) found.push({ start: match.index, end: match.index + match[0].length });
  return found;
}

const PYTHON = String.raw`
import ast, io, json, re, sys, tokenize
def u16(s): return len(s.encode("utf-16-le")) // 2
def comments(src):
    lines = src.splitlines(keepends=True) or [""]
    starts = [0]
    for line in lines: starts.append(starts[-1] + u16(line))
    def at(row, col): return starts[row - 1] + u16(lines[row - 1][:col])
    def at_bytes(row, col): return starts[row - 1] + u16(lines[row - 1].encode()[:col].decode())
    found = []
    for token in tokenize.generate_tokens(io.StringIO(src).readline):
        if token.type != tokenize.COMMENT: continue
        if token.start[0] == 1 and token.string.startswith("#!"): continue
        if token.start[0] <= 2 and re.match(r"#.*coding[:=]", token.string): continue
        found.append({"start": at(*token.start), "end": at(*token.end)})
    for node in ast.walk(ast.parse(src)):
        body = getattr(node, "body", None)
        if not isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)) or not body: continue
        first = body[0]
        if isinstance(first, ast.Expr) and isinstance(first.value, ast.Constant) and isinstance(first.value.value, str):
            found.append({"start": at_bytes(first.lineno, first.col_offset), "end": at_bytes(first.end_lineno, first.end_col_offset), "with": "pass" if len(body) == 1 else ""})
    return found
out = {}
for path, src in json.load(sys.stdin).items():
    try: out[path] = comments(src)
    except SyntaxError as error: out[path] = {"error": f"{error.msg} (line {error.lineno})"}
json.dump(out, sys.stdout)
`;

function pythonComments(files) {
  if (!files.size) return new Map();
  const run = spawnSync("python3", ["-I", "-c", PYTHON], { input: JSON.stringify(Object.fromEntries(files)), encoding: "utf8", maxBuffer: 1 << 28 });
  if (run.status !== 0) throw new Error(`python3 could not read the Python files: ${run.stderr || run.error}`);
  return new Map(Object.entries(JSON.parse(run.stdout)));
}

const FINDERS = [
  [/\.[cm]?[jt]sx?$/, scriptComments],
  [/\.css$/, text => cssComments(text)],
  [/\.sql$/, text => sqlComments(text)],
  [/\.(html|svg|xml)$/, markupComments],
  [/\.(sh|bash)$/, text => hashComments(text, { quotes: "\"'", heredocs: true, wordStart: /[\s;&|()]/ })],
  [/\.toml$/, text => hashComments(text, { quotes: "\"'", wordStart: /./s })],
  [/\.ya?ml$/, text => hashComments(text, { quotes: "\"'", wordStart: /\s/ })],
  [/(^|\/)\.(gitignore|vercelignore|gitattributes|npmignore)$/, lineComments],
];
const finderFor = path => FINDERS.find(([pattern]) => pattern.test(path))?.[1];
const isPython = path => path.endsWith(".py");
const isDoc = path => /\.mdx?$/i.test(path) && path !== DOC;
const vendored = path => VENDORED.some(pattern => pattern.test(path));

function strip(text, ranges) {
  const sorted = ranges.toSorted((a, b) => a.start - b.start);
  const flat = text.split("");
  for (const { start, end } of sorted) for (let k = start; k < end; k++) if (flat[k] !== "\n") flat[k] = "\u0001";
  const masked = flat.join("");
  const blank = s => /^[\s\u0001]*$/.test(s);
  let out = "", at = 0;
  for (const range of sorted) {
    let { start, end } = range;
    if (start < at) continue;
    if (range.with) { out += text.slice(at, start) + range.with; at = end; continue; }
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    const newline = text.indexOf("\n", end);
    const lineEnd = newline < 0 ? text.length : newline;
    let middle = "";
    if (blank(masked.slice(lineStart, start)) && blank(masked.slice(end, lineEnd))) {
      start = Math.max(lineStart, at);
      end = newline < 0 ? text.length : newline + 1;
      const kept = out + text.slice(at, start);
      if (kept === "" || /\n[ \t]*\n$/.test(kept) || /^\n?$/.test(kept)) while (end < text.length) {
        const next = text.indexOf("\n", end);
        if (next < 0 || !/^[ \t]*$/.test(text.slice(end, next))) break;
        end = next + 1;
      }
    } else if (blank(masked.slice(end, lineEnd))) {
      while (start > Math.max(lineStart, at) && /[ \t]/.test(text[start - 1])) start--;
    } else if (/[ \t]/.test(text[start - 1] ?? "")) {
      while (end < lineEnd && /[ \t]/.test(text[end])) end++;
    } else if (/[\w$]/.test(text[start - 1] ?? "") && /[\w$]/.test(text[end] ?? "")) middle = " ";
    out += text.slice(at, start) + middle;
    at = end;
  }
  out += text.slice(at);
  return out;
}

const lineOf = (text, index) => text.slice(0, index).split("\n").length;

function findAll(entries) {
  const python = pythonComments(new Map(entries.filter(([path]) => isPython(path))));
  const results = [];
  for (const [path, text] of entries) {
    if (isPython(path)) {
      const result = python.get(path);
      results.push({ path, text, ranges: Array.isArray(result) ? result : [], error: result?.error });
      continue;
    }
    const finder = finderFor(path);
    if (finder) results.push({ path, text, ranges: finder(text, path) });
  }
  return results;
}

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 1 << 28 });
const isText = buffer => !buffer.includes(0);
const links = () => new Set(git("ls-files", "-s", "-z").split("\0").filter(entry => entry.startsWith("120000 ")).map(entry => entry.split("\t")[1]));

function staged() {
  const paths = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z").split("\0").filter(Boolean);
  return paths.map(path => [path, execFileSync("git", ["show", `:${path}`], { maxBuffer: 1 << 28 })]);
}

function tracked(only) {
  const paths = only.length ? only : git("ls-files", "-z").split("\0").filter(Boolean);
  return paths.flatMap(path => {
    try { return [[path, readFileSync(path)]]; } catch { return []; }
  });
}

function install() {
  if (spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" }).status !== 0) return 0;
  if (spawnSync("git", ["config", "--get", "core.hooksPath"], { encoding: "utf8" }).stdout.trim() === ".githooks") return 0;
  git("config", "core.hooksPath", ".githooks");
  return 0;
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) { console.log(USAGE); return 0; }
  if (args.includes("--install")) return install();
  const unknown = args.find(arg => arg.startsWith("--") && arg !== "--fix" && arg !== "--all");
  if (unknown) { console.error(`Unknown option ${unknown}\n${USAGE}`); return 2; }
  const fix = args.includes("--fix");
  const all = args.includes("--all");
  const paths = args.filter(arg => !arg.startsWith("--"));
  const symlinks = links();
  const files = (fix || all || paths.length ? tracked(paths) : staged())
    .filter(([path, buffer]) => !vendored(path) && !symlinks.has(path) && isText(buffer))
    .map(([path, buffer]) => [path, buffer.toString("utf8")]);
  const docs = files.map(([path]) => path).filter(isDoc);
  const results = findAll(files.filter(([path]) => !isDoc(path)));
  if (fix) {
    let changed = 0;
    for (const { path, text, ranges, error } of results) {
      if (error) { console.error(`${path}: ${error}`); continue; }
      if (!ranges.length) continue;
      writeFileSync(path, strip(text, ranges));
      changed++;
    }
    console.log(`Removed comments from ${changed} file${changed === 1 ? "" : "s"}.`);
    if (docs.length) console.error(`Docs to delete (${DOC} is the only one): ${docs.join(", ")}`);
    return docs.length ? 1 : 0;
  }
  const problems = [];
  for (const { path, text, ranges, error } of results) {
    if (error) problems.push(`${path}: ${error}`);
    for (const { start, end } of ranges) problems.push(`${path}:${lineOf(text, start)}: ${text.slice(start, end).split("\n")[0].trim().slice(0, 80)}`);
  }
  for (const path of docs) problems.push(`${path}: a doc file`);
  if (!problems.length) return 0;
  console.error(problems.join("\n"));
  console.error(`\nThis repo keeps no comments and no docs besides ${DOC}: the code is the only description of itself.
Put the reason for a change in its commit message. node scripts/no-prose.mjs --fix removes the comments.`);
  return 1;
}

process.exit(main());
