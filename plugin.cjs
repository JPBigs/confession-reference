const { EditorSuggest, Plugin, PluginSettingTab, Setting, Notice, Modal, TFile, TFolder, FuzzySuggestModal } = require("obsidian");

class ConfessionSuggest extends EditorSuggest {
  constructor(plugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onTrigger(cursor, editor) {
    const trigger = reference.findTrigger(editor.getLine(cursor.line), cursor.ch);
    if (!trigger) return null;
    return { start: { line: cursor.line, ch: trigger.start }, end: cursor, query: trigger.query };
  }

  async getSuggestions(context) {
    const matches = reference.lookup(entries, context.query);
    if (!this.plugin.quote) return matches;

    const editions = new Map();
    return Promise.all(matches.map(async entry => {
      const path = this.plugin.editionNotes[documentKey(entry.key)];
      if (!path) return entry;

      if (!editions.has(path)) editions.set(path, this.plugin.readEdition(path));
      const edition = await editions.get(path);
      const body = edition?.entries.get(entry.key);
      return body ? {
        ...entry, body, heading: edition.headings.get(entry.key), question: undefined,
        personalEdition: edition.name, personalSource: edition.source,
      } : entry;
    }));
  }

  renderSuggestion(entry, element) {
    element.createDiv({ text: entry.label, cls: "suggestion-title" });
    const preview = entry.question ?? entry.body ?? "Open official text";
    element.createDiv({ text: preview.slice(0, 130), cls: "suggestion-note" });
  }

  selectSuggestion(entry) {
    const context = this.context;
    if (!context) return;
    const { editor, start, end, query } = context;
    if (editor.getRange(start, end) !== `;;${query}`) return;
    const quote = this.plugin.quote;
    const rendered = reference.format(entry, quote);
    if (!quote || !entry.body) {
      editor.replaceRange(rendered, start, end);
      return;
    }
    const line = editor.getLine(start.line);
    const before = line.slice(0, start.ch).trim() ? "\n\n" : "";
    const after = line.slice(end.ch).trim() ? "\n" : "";
    editor.replaceRange(before + rendered + after, start, end);
  }
}

module.exports = class ConfessionReference extends Plugin {
  async onload() {
    const saved = await this.loadData();
    this.quote = saved?.quote === true;
    this.editionNotes = {};
    if (saved?.editionsByDocument) {
      for (const { key } of documents) {
        const path = saved.editionsByDocument[key];
        if (typeof path === "string" && path) this.editionNotes[key] = path;
      }
    } else if (typeof saved?.personalNote === "string" && saved.personalNote) {
      const edition = await this.readEdition(saved.personalNote);
      for (const entry of entries) {
        if (edition?.entries.get(entry.key)) this.editionNotes[documentKey(entry.key)] = saved.personalNote;
      }
    }
    this.registerEditorSuggest(new ConfessionSuggest(this));
    this.addSettingTab(new ConfessionSettings(this.app, this));
  }

  async readEdition(path) {
    const vault = this.app.vault;
    const file = vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile) || file.extension !== "md") return null;

    try {
      return reference.readVaultEdition(await vault.cachedRead(file), file.basename);
    } catch {
      return null;
    }
  }

  saveSettings() {
    const data = { quote: this.quote, editionsByDocument: { ...this.editionNotes } };
    this.pendingSave = (this.pendingSave ?? Promise.resolve()).catch(() => {}).then(() => this.saveData(data));
    return this.pendingSave;
  }

  async savePreferences() {
    try {
      await this.saveSettings();
    } catch {
      new Notice("Confession Reference could not save its settings.");
    }
  }
};

class ConfessionSettings extends PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display() {
    this.containerEl.empty();
    new Setting(this.containerEl)
      .setName("Insert quotations")
      .setDesc("Insert a quotation with its edition. Turn off to insert a source link.")
      .addToggle(toggle => toggle.setValue(this.plugin.quote).onChange(async quote => {
        this.plugin.quote = quote;
        await this.plugin.savePreferences();
      }));

    new Setting(this.containerEl)
      .setName("Editions for quotations")
      .setHeading()
      .setDesc("Default editions are public domain historical texts included with the plugin. Each document uses its default edition when a personal note or matching citation is unavailable.");

    const vault = this.app.vault;
    for (const document of documents) {
      const { key, name, bundled } = document;
      const path = this.plugin.editionNotes[key];
      const file = path ? vault.getAbstractFileByPath(path) : null;
      const status = file instanceof TFile ? `Personal edition: ${path}`
        : path ? `Using default edition. Personal note missing: ${path}` : "Using default edition.";
      const row = new Setting(this.containerEl)
        .setName(name)
        .setDesc(`${status} Default text: ${bundled}.`)
        .addButton(button => button.setButtonText(path ? "Change edition" : "Add edition").onClick(() => {
          new PersonalEditionModal(this.app, this.plugin, document, () => this.display()).open();
        }));

      if (file instanceof TFile) {
        row.addButton(button => button.setButtonText("Open note").onClick(async () => {
          await this.app.workspace.getLeaf().openFile(file);
        }));
      }
      if (path) {
        row.addButton(button => button.setButtonText("Use default").onClick(async () => {
          delete this.plugin.editionNotes[key];
          await this.plugin.savePreferences();
          this.display();
        }));
      }
    }
  }
}

const editionFolder = "Confession Reference Editions";

const documents = [
  { key: "wcf", name: "Westminster Confession of Faith", bundled: "Westminster Assembly’s English text, 1647 printing" },
  { key: "wsc", name: "Westminster Shorter Catechism", bundled: "Westminster Assembly’s English text, 1647 printing" },
  { key: "wlc", name: "Westminster Larger Catechism", bundled: "Westminster Assembly’s 1647 English text, London printing (1658)" },
  { key: "hc", name: "Heidelberg Catechism", bundled: "English translation from Philip Schaff’s The Creeds of Christendom, vol. III (1877)" },
  { key: "bc", name: "Belgic Confession", bundled: "English translation from Philip Schaff’s The Creeds of Christendom, vol. III (1877)" },
  { key: "dort", name: "Canons of Dort", bundled: "Thomas Scott’s English translation (1841)" },
];

function documentKey(citation) {
  return /^[a-z]+/.exec(citation)[0];
}

class PersonalEditionModal extends Modal {
  constructor(app, plugin, document, onSaved) {
    super(app);
    this.plugin = plugin;
    this.document = document;
    this.onSaved = onSaved;
  }

  onOpen() {
    const { key, name } = this.document;
    this.setTitle(`Personal edition for ${name}`);
    let source = "";
    let body = "";
    const countCitations = edition => entries.filter(entry =>
      documentKey(entry.key) === key && edition?.entries.get(entry.key)).length;

    new Setting(this.contentEl)
      .setName("Use an existing edition note")
      .addButton(button => button.setButtonText("Use note").onClick(() => {
        new EditionNotePicker(this.app, async file => {
          const edition = await this.plugin.readEdition(file.path);
          if (!countCitations(edition)) {
            feedback.setText(`No citations for ${name} found in ${file.path}.`);
            return;
          }

          this.plugin.editionNotes[key] = file.path;
          await this.plugin.savePreferences();
          this.close();
          this.onSaved();
        }).open();
      }));

    new Setting(this.contentEl)
      .setName("Confession text")
      .setDesc("Paste the whole document, including its headings and section numbers. Use text you have the right to copy.")
      .addTextArea(input => {
        input.setPlaceholder("Paste your translation here");
        input.inputEl.rows = 10;
        input.inputEl.addClass("confession-reference-edition-text");
        input.onChange(value => { body = value; });
      });

    new Setting(this.contentEl)
      .setName("Source link")
      .setDesc("This link will appear in quotations from your edition.")
      .addText(input => input.setPlaceholder("https://example.org/translation").onChange(value => {
        source = value.trim();
      }));

    const feedback = this.contentEl.createDiv({ attr: { role: "status" } });
    new Setting(this.contentEl).addButton(button => button.setButtonText("Save to vault").setCta().onClick(async () => {
      if (!body.trim()) {
        feedback.setText("Paste the text of your edition.");
        return;
      }

      const title = `${name} - Personal edition`;
      const markdown = `# ${title}\nSource: ${source}\n\n${body.trim()}\n`;
      const edition = reference.readVaultEdition(markdown, title);
      if (!source || !edition.source || /\s/.test(source) || !/^https?:\/\//i.test(source)) {
        feedback.setText("Enter a complete source link beginning with https:// or http://.");
        return;
      }

      const detected = countCitations(edition);
      if (!detected) {
        feedback.setText("No citations detected. Check that the pasted text includes its original headings and numbers.");
        return;
      }

      button.setDisabled(true);
      let file;
      try {
        const vault = this.app.vault;
        if (!(vault.getAbstractFileByPath(editionFolder) instanceof TFolder)) {
          try {
            await vault.createFolder(editionFolder);
          } catch (error) {
            if (!(vault.getAbstractFileByPath(editionFolder) instanceof TFolder)) throw error;
          }
        }

        const basePath = `${editionFolder}/${title}`;
        let path = `${basePath}.md`;
        for (let index = 2; vault.getAbstractFileByPath(path); index++) {
          path = `${basePath} ${index}.md`;
        }
        file = await vault.create(path, markdown);
        this.plugin.editionNotes[key] = file.path;
        this.plugin.quote = true;
        await this.plugin.saveSettings();
      } catch {
        if (file) {
          feedback.setText(`Saved ${file.path}. The plugin settings could not be saved. Use the existing note option to select it again.`);
          return;
        }
        feedback.setText("Could not create the note. Your pasted text is still here.");
        button.setDisabled(false);
        return;
      }

      new Notice(`Personal edition saved. Detected ${detected} citations.`);
      this.close();
      this.onSaved();
    }));
  }

  onClose() {
    this.contentEl.empty();
  }
}

class EditionNotePicker extends FuzzySuggestModal {
  constructor(app, onChoose) {
    super(app);
    this.onChoose = onChoose;
    this.setPlaceholder("Search vault notes by name or folder");
  }

  getItems() {
    return this.app.vault.getMarkdownFiles().sort((a, b) => a.path.localeCompare(b.path));
  }

  getItemText(file) {
    return file.path;
  }

  onChooseItem(file) {
    return this.onChoose(file);
  }
}
