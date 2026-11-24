const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");
const vm = require("node:vm");
const entries = require("./corpus.json");
const { findTrigger, lookup, format } = require("./references.cjs");

test("all references are unique and all URLs use known HTTPS sources", () => {
  assert.equal(new Set(entries.map(entry => entry.key)).size, entries.length);
  for (const entry of entries) {
    assert.ok(entry.body && entry.edition, entry.key);
    if (entry.quoteUrl) {
      const quoteUrl = new URL(entry.quoteUrl);
      const origin = entry.key.startsWith("dort") ? "https://upload.wikimedia.org" : "https://reformedchurch.com";
      assert.equal(quoteUrl.origin, origin);
    }
    const url = new URL(entry.url);
    assert.equal(url.protocol, "https:");
    assert.ok(["archive.org", "www.crcna.org"].includes(url.hostname));
  }
});

test("supports all six documents and distinguishes the Dort heads and rejections", () => {
  for (const key of ["wcf 1.6", "wsc 1", "wlc 45", "hc 1", "bc 29", "dort 3/4.11", "dort 5.r1"]) {
    assert.equal(lookup(entries, key)[0].key, key.replaceAll(" ", ""));
  }
  assert.equal(lookup(entries, "dort 4.1").length, 0);
  assert.equal(lookup(entries, "dort 5.16").length, 0);
});

test("recognizes the trigger without touching Bible Reference or a mid-token cursor", () => {
  assert.deepEqual(findTrigger("See ;;wcf 1.6", 13), { start: 4, query: "wcf 1.6" });
  assert.equal(findTrigger("--John1:1", 9), null);
  assert.equal(findTrigger(";;hc 129", 6), null);
});

test("formats an attributed Westminster quote and a CRCNA link", () => {
  assert.match(format(lookup(entries, "WSC 1")[0], true), /^> \[!confession\] \[WSC Q&A 1 - Historic Westminster\]\(https:\/\/[^\n]+\)\n> What is the chief end of man\?/);
  assert.match(format(lookup(entries, "WSC 1")[0], true), /Historic Westminster/);
  assert.match(format(lookup(entries, "hc 1")[0], false), /^\[Heidelberg Catechism Q&A 1\]\(https:\/\/www\.crcna\.org/);
});

test("built plugin registers suggestions and replaces only the typed reference", async () => {
  const obsidian = {
    EditorSuggest: class {},
    Plugin: class {
      async loadData() { return {quote: false}; }
      async saveData(data) { this.saved = data; }
      registerEditorSuggest(suggester) { this.suggester = suggester; }
      addSettingTab() {}
    },
    PluginSettingTab: class {},
    Modal: class {},
    FuzzySuggestModal: class {},
  };
  const sandbox = { module: {exports: {}}, require: name => {
    assert.equal(name, "obsidian");
    return obsidian;
  }};
  vm.runInNewContext(fs.readFileSync("main.js", "utf8"), sandbox);
  const plugin = new sandbox.module.exports();
  await plugin.onload();
  let line = "See ;;hc 1";
  const editor = {
    getLine: () => line,
    getRange: (start, end) => line.slice(start.ch, end.ch),
    replaceRange: (value, start, end) => {
      line = line.slice(0, start.ch) + value + line.slice(end.ch);
    },
  };
  const context = plugin.suggester.onTrigger({line: 0, ch: line.length}, editor);
  plugin.suggester.context = {...context, editor};
  plugin.suggester.selectSuggestion((await plugin.suggester.getSuggestions(context))[0]);
  assert.match(line, /^See \[Heidelberg Catechism Q&A 1\]/);
});

test("quotes Heidelberg and Belgic with their historical edition and section link", () => {
  for (const key of ["hc 1", "hc 129", "bc 36"]) {
    const entry = lookup(entries, key)[0];
    const result = format(entry, true);
    assert.ok(result.startsWith(`> [!confession] [${entry.label} - ${entry.edition}](${entry.quoteUrl})\n`));
    assert.equal(
      result.split("\n").slice(1, -1).map(line => line.slice(2)).join("\n"),
      [entry.question, entry.body].filter(Boolean).join("\n\n"),
    );
  }
});

test("Dort quotes cite Scott's printed pages and link mode opens the CRCNA edition", () => {
  const dort = entries.filter(entry => entry.key.startsWith("dort"));
  assert.equal(dort.length, 93);

  for (const [key, pages, startPage, opening] of [
    ["dort 1.1", "p. 260", 260, "As all men have sinned in Adam, and have become exposed"],
    ["dort 3/4.12", "pp. 299–300", 299, "And this is that regeneration"],
    ["dort 5.r8", "p. 329", 329, "Who teach that “it is not absurd"],
    ["dort 5.r9", "pp. 329–330", 329, "Who teach that “Christ doth in no wise pray"],
  ]) {
    const entry = lookup(entries, key)[0];
    assert.equal(entry.edition, `Thomas Scott (1841), ${pages}`);
    assert.equal(entry.quoteUrl, `https://upload.wikimedia.org/wikipedia/commons/7/7f/The_articles_of_the_Synod_of_Dort_%28IA_articlesofsynodo1841syno%29.pdf#page=${startPage + 6}`);
    assert.ok(format(entry, true).startsWith(
      `> [!confession] [${entry.label} - ${entry.edition}](${entry.quoteUrl})\n> ${opening}`,
    ));
    assert.equal(format(entry, false), `[${entry.label}](https://www.crcna.org/welcome/beliefs/confessions/canons-dort)`);
  }
});

test("parses a pasted full document with one source URL and original numbering", () => {
  const { readVaultEdition } = require("./references.cjs");
  const cases = [
    ["Westminster Confession of Faith", "## Chapter XVI\n1. First paragraph.\n2. Second paragraph.", "wcf16.2", "Second paragraph."],
    ["Heidelberg Catechism", "Q. 1. My question\nA. My answer", "hc1", "My question\nA. My answer"],
    ["Westminster Shorter Catechism", "## Q&A 1\nFirst answer.", "wsc1", "First answer."],
    ["Westminster Larger Catechism", "Question 2. Question\nAnswer", "wlc2", "Question\nAnswer"],
    ["Belgic Confession", "### Article XXIX: The marks\nArticle body.", "bc29", "Article body."],
    ["Canons of Dort", "## Third and Fourth Heads of Doctrine\n### Article 1: Heading\nArticle body.\n## Rejection of Errors\n1. Rejection body.", "dort3/4.r1", "Rejection body."],
  ];
  for (const [title, content, key, body] of cases) {
    const edition = readVaultEdition(`# ${title}\nSource: https://example.org/edition\n\n${content}`, "My translation");
    assert.equal(edition.source, "https://example.org/edition");
    assert.equal(edition.entries.get(key), body, title);
  }
});

test("registered suggester uses vault text and shared source in quote mode only", async () => {
  class TFile {
    extension = "md";
    basename = "My Heidelberg Catechism";
  }
  const file = new TFile();
  const belgic = Object.assign(new TFile(), { basename: "My Belgic Confession" });
  let text = "Source: https://example.org/edition\nQuestion 1. Personal wording.";
  const obsidian = {
    TFile,
    EditorSuggest: class {},
    Plugin: class {
      app = { vault: {
        getAbstractFileByPath: path => ({ "Edition.md": file, "Belgic.md": belgic })[path],
        cachedRead: async note => note === file ? text : "Article 1. Personal Belgic wording.",
      } };
      async loadData() { return { quote: true, personalNote: "Edition.md" }; }
      async saveData(data) { this.saved = data; }
      registerEditorSuggest(suggester) { this.suggester = suggester; }
      addSettingTab() {}
    },
    PluginSettingTab: class {},
    Modal: class {},
    FuzzySuggestModal: class {},
  };
  const sandbox = { module: { exports: {} }, require: () => obsidian, URL };
  vm.runInNewContext(fs.readFileSync("main.js", "utf8"), sandbox);
  const plugin = new sandbox.module.exports();
  await plugin.onload();
  const match = async query => (await plugin.suggester.getSuggestions({ query }))[0];

  const personal = await match("hc 1");
  assert.match(format(personal, true), /My Heidelberg Catechism\]\(https:\/\/example.org\/edition\)\n> Personal wording/);
  assert.equal(personal.question, undefined);
  assert.equal((await match("hc 2")).personalEdition, undefined);
  text = text.replace("Personal wording", "Edited wording");
  assert.equal((await match("hc 1")).body, "Edited wording.");
  assert.equal(plugin.editionNotes.hc, "Edition.md");
  assert.equal((await match("bc 1")).personalEdition, undefined);
  plugin.editionNotes.bc = "Belgic.md";
  assert.equal((await match("bc 1")).body, "Personal Belgic wording.");
  assert.equal((await match("hc 1")).body, "Edited wording.");
  await plugin.saveSettings();
  assert.equal(plugin.saved.editionsByDocument.bc, "Belgic.md");
  assert.equal(plugin.saved.editionsByDocument.hc, "Edition.md");
  plugin.editionNotes.hc = "Missing.md";
  assert.equal((await match("hc 1")).personalEdition, undefined);
  assert.equal((await match("bc 1")).body, "Personal Belgic wording.");
  plugin.editionNotes.hc = "Edition.md";
  plugin.quote = false;
  assert.match(format(await match("hc 1"), false), /https:\/\/www.crcna.org/);
});

test("omits pasted Scripture footnotes and skips navigation between questions", () => {
  const { readVaultEdition } = require("./references.cjs");
  const markdown = [
    "Lord’s Day 1", "Q & A 1", "A sample sentence.1",
    "Another phrase—2 followed by ordinary text.",
    "A third reference: 3", "An inline citation stays as Acts 2:1-3.",
    "", "1 1 Cor. 6:19-20", "2Matt. 3:16-17; 28:18-19",
    "3 Acts 14:15-17/a>; Prov. 22:2", "Back to top",
    "Part I: Misery", "Lord’s Day 2", "Q & A 3",
    "A different passage.1", "1 Ps. 8", "Q & A 80*",
    "An editorial mark belongs to this entry.*", "Additional Translations",
    "Site navigation that should be ignored.",
  ].join("\n");
  const edition = readVaultEdition(markdown, "Heidelberg Catechism - Test");
  const first = edition.entries.get("hc1");
  assert.equal(first, [
    "A sample sentence.",
    "Another phrase— followed by ordinary text.",
    "A third reference:",
    "An inline citation stays as Acts 2:1-3.",
  ].join("\n"));
  assert.equal(edition.entries.get("hc3"), "A different passage.");
  assert.equal(edition.entries.get("hc80"), "An editorial mark belongs to this entry.*");
});
