function findTrigger(line, cursor) {
  const match = /(?:^|\s)(;;([a-z]*(?:[ \t]*[0-9][0-9./rR]*)?))$/i.exec(line.slice(0, cursor));
  if (!match || match[2].length > 30) return null;
  // Avoid replacing the beginning of a reference when the caret is mid-token.
  if (/[a-z0-9/]/i.test(line[cursor] ?? "")) return null;
  return { start: cursor - match[1].length, query: match[2] };
}

function lookup(entries, input) {
  const query = input.toLowerCase().replace(/\s+/g, "");
  const exact = entries.filter(entry => entry.key === query);
  const prefixes = entries.filter(entry => entry.key !== query && entry.key.startsWith(query));
  return [...exact, ...prefixes].slice(0, 12);
}

function readVaultEdition(markdown, name) {
  const lines = markdown.split(/\r\n?|\n/);
  const entries = new Map();
  const titles = [
    ["wcf", /Westminster Confession(?: of Faith)?/i],
    ["wsc", /(?:Westminster )?Shorter Catechism/i],
    ["wlc", /(?:Westminster )?Larger Catechism/i],
    ["hc", /Heidelberg Catechism/i],
    ["bc", /Belgic Confession/i],
    ["dort", /Canons of Dor[dt]t?/i],
  ];
  const titleCandidates = [name, ...lines.slice(0, 12).map(line => line.trim().replace(/^#+\s*/, ""))];
  const document = titleCandidates.map(title => titles.find(([, pattern]) =>
    pattern.test(title) && !/^https?:/i.test(title))?.[0]).find(Boolean);

  let source;
  let key;
  let section;
  let rejecting = false;
  let body = [];
  const save = () => {
    const text = omitScriptureNotes(body).trim();
    if (key && text) {
      if (entries.has(key)) entries.set(key, null);
      else entries.set(key, text);
    }
    key = undefined;
    body = [];
  };

  for (const line of lines) {
    const text = line.trim().replace(/^#{1,6}\s+/, "").replace(/^\*\*(.*?)\*\*$/, "$1");
    if (!key && !source) {
      const url = /^(?:source:\s*)?(?:<)?(https?:\/\/[^\s<>]+)>?$/i.exec(text)?.[1];
      if (url) {
        try {
          source = new URL(url).href.replace(/[()]/g, character => character === "(" ? "%28" : "%29");
        } catch {
          // Keep reading the note when the source link is malformed.
        }
        continue;
      }
    }

    if (/^(?:lord[’']s day\s+\d+|back to top|additional translations|part\s+[ivx]+\s*:.*)$/i.test(text)) {
      save();
      continue;
    }

    const explicit = /^(?:;;)?(wcf|wsc|wlc|hc|bc|dort)\s*(\d[\d./r]*)$/i.exec(text);
    if (explicit) {
      save();
      key = (explicit[1] + explicit[2]).toLowerCase();
      continue;
    }

    const chapter = /^chapter\s+(\d+|[ivxl]+)\b/i.exec(text);
    if (document === "wcf" && chapter) {
      save();
      section = readNumber(chapter[1]);
      continue;
    }

    const head = /\b(first|second|third(?:\s+and\s+fourth)?|fourth|fifth)\s+(?:heads?|main points?)\b/i.exec(text);
    if (document === "dort" && head && /^(?:the\s+)?(?:first|second|third|fourth|fifth)\b/i.test(text)) {
      save();
      section = { first: "1", second: "2", third: "3/4", fourth: "3/4", fifth: "5" }[head[1].toLowerCase().split(/\s+/)[0]];
      rejecting = false;
      continue;
    }

    if (document === "dort" && /^rejection of (?:the )?errors\b/i.test(text)) {
      save();
      rejecting = true;
      continue;
    }

    if (document === "dort" && /^conclusion\b/i.test(text)) {
      save();
      section = undefined;
      continue;
    }

    const marker = /^(?:(question|q(?:\s*&\s*a)?\.?|article|art\.?|section|rejection)\s*(\d+|[ivxl]+)\b[.:)]?\s*(.*)|(\d+)[.)]\s*(.*))$/i.exec(text);
    if (marker && document) {
      const [, label, number, inline, bareNumber, bareInline] = marker;
      const n = readNumber(number ?? bareNumber);
      const catechism = ["wsc", "wlc", "hc"].includes(document);
      const citation = catechism && (!label || /^(?:q|question)/i.test(label))
        ? document + n
        : document === "bc" && (!label || /^art/i.test(label))
          ? document + n
          : section && (document === "wcf" || document === "dort")
            ? `${document}${section}.${rejecting || /^rejection$/i.test(label ?? "") ? "r" : ""}${n}`
            : undefined;
      if (citation) {
        save();
        key = citation;
        const remainder = (bareInline ?? inline)?.replace(/^\*+\s*/, "");
        if (remainder && (!/^#{1,6}\s/.test(line.trim()) || catechism)) body.push(remainder);
        continue;
      }
    }

    if (key) body.push(line);
  }

  save();
  return { name, source, entries };
}

function omitScriptureNotes(lines) {
  const numbers = new Set();
  const prose = [];
  for (const line of lines) {
    // A numbered proof line begins with a Bible book and a chapter or verse number.
    const note = /^(\d{1,2})\s*((?:[1-3]\s+)?[A-Z][a-z]+\.?(?:\s+[A-Z][a-z]+)?\s+\d.*)$/.exec(line.trim());
    if (note) numbers.add(note[1]);
    else prose.push(line);
  }

  const body = prose.join("\n").trim();
  if (!numbers.size) return body;

  return body.replace(/(?:((?<=[\p{L}.!?;,”“’"—)\]])\d{1,2})|(?<=[.!?;:,”’—])[ \t]+(\d{1,2}))(?=$|[^\d:\-–])/gu,
    (marker, attached, spaced) => {
      const number = attached ?? spaced;
      return numbers.has(number) ? "" : marker;
    });
}

function readNumber(number) {
  if (/^\d+$/.test(number)) return Number(number);
  const digits = { I: 1, V: 5, X: 10, L: 50 };
  const values = [...number.toUpperCase()].map(character => digits[character]);
  return values.reduce((sum, value, index) => sum + (value < (values[index + 1] ?? 0) ? -value : value), 0);
}

function format(entry, quote) {
  const url = quote && entry.body ? (entry.quoteUrl ?? entry.url) : entry.url;
  if (!quote || !entry.body) return `[${entry.label}](${url})`;
  const edition = entry.personalEdition ?? entry.edition;
  const label = `${entry.label} - ${edition.replace(/[\\`*_{}[\]<>!|~]/g, "\\$&")}`;
  const source = entry.personalEdition ? entry.personalSource : url;
  const title = source ? `[${label}](${source})` : label;
  const body = [entry.question, entry.body].filter(Boolean).join("\n\n");
  const block = body.split("\n").map(line => line ? `> ${line}` : ">").join("\n");
  return `> [!confession] ${title}\n${block}\n`;
}

module.exports = { findTrigger, lookup, format, readVaultEdition };
