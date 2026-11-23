const fs = require("node:fs");

const data = JSON.parse(fs.readFileSync("corpus.json", "utf8"));
const references = fs.readFileSync("references.cjs", "utf8");
const plugin = fs.readFileSync("plugin.cjs", "utf8");
fs.writeFileSync("main.js", [
  "/* Confession Reference plugin code only. Bundled texts retain their source terms.",
  fs.readFileSync("LICENSE", "utf8").trimEnd(),
  "*/",
  '"use strict";',
  `const entries = ${JSON.stringify(data)};`,
  "const reference = (() => {",
  "const module = { exports: {} };",
  references,
  "return module.exports;",
  "})();",
  plugin,
].join("\n"));
