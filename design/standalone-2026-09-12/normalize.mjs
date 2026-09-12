#!/usr/bin/env node
// normalize.mjs — the recipe this record was measured with (2026-09-12).
//
// A __bundler standalone ships Babel's output, compacted: comments gone,
// quotes normalised, one line per module. Two builds of one source can
// differ by nothing but that, so the comparison is made on the AST:
// parse, drop comments and every literal's raw spelling, regenerate with
// double quotes. Two files that normalise identical are the same design.
//
//   node design/standalone-2026-09-12/normalize.mjs <in.js> <out.js>
//
// A record held as JSX source (v28, 08-24, 08-26, v18's modules) is first
// compiled with the 09-02 README's recipe (@babel/preset-react, classic
// runtime), then normalised the same way. hashes.json is the sha256 of
// each normalised module, first ten hex digits — rerun this on the next
// bundle and compare the maps, which is what the 09-08 README asked for.
// Runs from the repository root: @babel/parser and @babel/generator are
// the tree's own dependencies.
import { parse } from "@babel/parser";
import generateMod from "@babel/generator";
import fs from "node:fs";
const generate = generateMod.default || generateMod;
function unwrap(src) {
  // the bundle wraps each module: try{(function(){ … })()}catch(e){console.error("[boot] src/x failed:",e)}
  const m = src.match(/^try\{\(function\(\)\{\n?([\s\S]*)\n?\}\)\(\)\}catch\(e\)\{console\.error\("\[boot\][^\n]*\n?(?:[\s\S]*)?$/);
  return m ? m[1] : src;
}
function strip(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) { node.forEach(strip); return; }
  if (node.type === "StringLiteral" || node.type === "NumericLiteral" || node.type === "TemplateElement") delete node.extra;
  for (const k of Object.keys(node)) if (k !== "loc" && k !== "extra") strip(node[k]);
}
export function normalize(src) {
  const ast = parse(unwrap(src), { sourceType: "script", plugins: ["jsx"], allowReturnOutsideFunction: true, errorRecovery: true });
  strip(ast);
  return generate(ast, { comments: false, compact: false, jsescOption: { minimal: true, quotes: "double" } }).code;
}
if (process.argv[2]) fs.writeFileSync(process.argv[3], normalize(fs.readFileSync(process.argv[2], "utf8")) + "\n");
