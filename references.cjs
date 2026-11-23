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

function format(entry, quote) {
  const url = quote && entry.body ? (entry.quoteUrl ?? entry.url) : entry.url;
  if (!quote || !entry.body) return `[${entry.label}](${url})`;
  const title = `[${entry.label} - ${entry.edition}](${url})`;
  const body = [entry.question, entry.body].filter(Boolean).join("\n\n");
  const block = body.split("\n").map(line => line ? `> ${line}` : ">").join("\n");
  return `> [!confession] ${title}\n${block}\n`;
}

module.exports = { findTrigger, lookup, format };
