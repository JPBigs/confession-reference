const { EditorSuggest, Plugin, PluginSettingTab, Setting } = require("obsidian");

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

  getSuggestions(context) {
    return reference.lookup(entries, context.query);
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
    this.quote = (await this.loadData())?.quote === true;
    this.registerEditorSuggest(new ConfessionSuggest(this));
    this.addSettingTab(new ConfessionSettings(this.app, this));
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
      .setDesc("Insert the bundled historical text with an edition citation. Turn off to insert a source link.")
      .addToggle(toggle => toggle.setValue(this.plugin.quote).onChange(async quote => {
        this.plugin.quote = quote;
        await this.plugin.saveData({ quote });
      }));
  }
}
