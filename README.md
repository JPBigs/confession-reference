# Confession Reference

An Obsidian plugin for citing the Westminster Standards and the Three Forms of Unity.

**AI-assisted development.** This plugin was built with AI coding assistance. Bugs and transcription errors are possible. If you plan to quote or publish a passage, check the wording against the linked source edition. Please report discrepancies or plugin bugs through GitHub Issues.

## Install in Obsidian

Once Confession Reference is listed in the Obsidian Community directory, open **Settings → Community plugins → Browse** and search for **Confession Reference**. Select **Install**, then **Enable**. Obsidian creates the plugin folder and downloads the files for you.

## Use Confession Reference

In an editable note, type one of these references and choose a suggestion.

| Type | Reference |
| --- | --- |
| `;;wcf 1.6` | Westminster Confession 1.6 |
| `;;wsc 1` | Westminster Shorter Catechism Q&A 1 |
| `;;wlc 45` | Westminster Larger Catechism Q&A 45 |
| `;;hc 1` | Heidelberg Catechism Q&A 1 |
| `;;bc 29` | Belgic Confession Article 29 |
| `;;dort 3/4.11` | Canons of Dort, Third and Fourth Heads, Article 11 |
| `;;dort 5.r1` | Canons of Dort, Fifth Head, Rejection of Errors 1 |
| `;;canons 3/4.r1` | Canons of Dort, Third and Fourth Heads, Rejection of Errors 1 |

For Dort rejections, put `r` before the rejection number. Type `;;dort 5.r` to browse rejections under the Fifth Head. Both `;;canons` and `;;cannons` work anywhere you would type `;;dort`.

By default, suggestions insert a Markdown link labeled with the precise citation. The link opens the source document. In plugin settings, enable **Insert quotations** to paste historical quotations from all six documents as callouts with a linked reference and edition.

## Quote a translation from your vault

In **Settings → Confession Reference**, find the document under **Editions for quotations** and select **Add edition**. Paste your translation with its original headings and numbering, and enter a source link. **Save to vault** creates an editable Markdown note in the vault’s **Confession Reference Editions** folder, enables quotations, and reports how many citations it detected.

To use an existing Markdown note, select **Use note** in the same dialog and find the file in the vault picker. You can search by name or folder path. Include the document’s name in the note title, a single `Source: https://…` line near the top, and the text with its original headings and numbering. Use text you have the right to copy and store.

```markdown
# Canons of Dort — My edition
Source: https://example.org/my-edition

## First Head of Doctrine
### Article 1
Paste the article here.

### Article 2
Paste the next article here.
```

Each document has its own edition setting. When **Insert quotations** is enabled, citations use the selected note’s text and source link when available. If the note or citation is missing, the plugin uses the default historical edition identified under that document in settings and in **Text sources** below. Select **Use default** on a document to switch it back.

The plugin recognizes common chapter and section numbers, articles, catechism questions, and Dort heads and rejections. For other layouts, add a heading such as `## dort 1.2` above an article or `## dort 3/4.r1` above a rejection. Inserted quotations omit recognized numbered Scripture footnotes and their matching inline markers. The saved edition note retains the original pasted text.

## Manual installation from GitHub

1. Download `main.js`, `manifest.json`, and `styles.css` from the [GitHub release](https://github.com/JPBigs/confession-reference/releases/latest). In your vault, create `.obsidian/plugins/confession-reference/` and copy the three files into it.
2. Restart Obsidian, then enable **Confession Reference** under **Settings → Community plugins**.

To update a manual installation, replace those three files and keep `data.json` to preserve your preferences. Reload Obsidian after syncing these files to other devices.

## Data and privacy

The lookup runs offline. There are no runtime dependencies beyond Obsidian. The plugin uses the active editor to suggest references and replaces the typed trigger when you choose an entry. It stores the quote preference and saved edition note paths and your selection in the plugin settings. Your pasted translation stays in the vault note. Quotes you insert are copied into the note you are editing. Following a source link opens the corresponding site in your browser.

## Text sources

- **Westminster Standards.** The [Creeds.json transcription](https://github.com/NonlinearFruit/Creeds.json/tree/2ae21a4c5387ecc91f474c9d3d67c826d2a6b9d5) is provided under the [Unlicense](https://unlicense.org/). The source metadata identifies historical print editions. The plugin includes the main text and catechism questions and omits proof texts.
- **Heidelberg Catechism and Belgic Confession.** The [Heidelberg](https://reformedchurch.com/confessions/heidelberg-catechism) and [Belgic](https://reformedchurch.com/confessions/belgic-confession) transcriptions use the public-domain English wording in Philip Schaff's [*The Creeds of Christendom*, vol. III (1877)](https://commons.wikimedia.org/wiki/File:The_creeds_of_Christendom_-_with_a_history_and_critical_notes_(IA_creedschristendo03scha).pdf).
- **Canons of Dort.** Quotes use the public-domain English translation by Thomas Scott in [*The Articles of the Synod of Dort* (Philadelphia, Presbyterian Board of Publication, 1841), pp. 260–330](https://upload.wikimedia.org/wikipedia/commons/7/7f/The_articles_of_the_Synod_of_Dort_%28IA_articlesofsynodo1841syno%29.pdf#page=266). The transcription includes the numbered articles and Rejections of Errors, with footnotes and other unnumbered material omitted. The final rejection is indexed as 5.r9 because the printing repeats 8.

## Build and verify

Use Node.js 20 or newer. Run `npm run build` to regenerate `main.js`, then `npm test`. There is no dependency installation step.

The automated checks cover citation lookup, insertion, vault editions, and bundle registration using an Obsidian API stub. To check app compatibility, install the built files in a test vault and try link insertion and quote mode on desktop and mobile.

## License

The plugin code is licensed under [MIT](LICENSE). The bundled confession texts follow the terms listed under Text sources.
