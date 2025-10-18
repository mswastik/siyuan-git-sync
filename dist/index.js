"use strict";
const siyuan = require("siyuan");
const createDefaultGetter = (type) => {
  let getter;
  switch (type) {
    case "checkbox":
      getter = (ele) => {
        return ele.checked;
      };
      break;
    case "select":
    case "slider":
    case "textinput":
    case "textarea":
      getter = (ele) => {
        return ele.value;
      };
      break;
    case "number":
      getter = (ele) => {
        return parseInt(ele.value);
      };
      break;
    default:
      getter = () => null;
      break;
  }
  return getter;
};
const createDefaultSetter = (type) => {
  let setter;
  switch (type) {
    case "checkbox":
      setter = (ele, value) => {
        ele.checked = value;
      };
      break;
    case "select":
    case "slider":
    case "textinput":
    case "textarea":
    case "number":
      setter = (ele, value) => {
        ele.value = value;
      };
      break;
    default:
      setter = () => {
      };
      break;
  }
  return setter;
};
class SettingUtils {
  constructor(args) {
    this.settings = /* @__PURE__ */ new Map();
    this.elements = /* @__PURE__ */ new Map();
    this.name = args.name ?? "settings";
    this.plugin = args.plugin;
    this.file = this.name.endsWith(".json") ? this.name : `${this.name}.json`;
    this.plugin.setting = new siyuan.Setting({
      width: args.width,
      height: args.height,
      confirmCallback: () => {
        for (let key of this.settings.keys()) {
          this.updateValueFromElement(key);
        }
        let data = this.dump();
        if (args.callback !== void 0) {
          args.callback(data);
        }
        this.plugin.data[this.name] = data;
        this.save(data);
      },
      destroyCallback: () => {
        for (let key of this.settings.keys()) {
          this.updateElementFromValue(key);
        }
      }
    });
  }
  async load() {
    let data = await this.plugin.loadData(this.file);
    console.debug("Load config:", data);
    if (data) {
      for (let [key, item] of this.settings) {
        item.value = (data == null ? void 0 : data[key]) ?? item.value;
      }
    }
    this.plugin.data[this.name] = this.dump();
    return data;
  }
  async save(data) {
    data = data ?? this.dump();
    await this.plugin.saveData(this.file, this.dump());
    console.debug("Save config:", data);
    return data;
  }
  /**
   * read the data after saving
   * @param key key name
   * @returns setting item value
   */
  get(key) {
    var _a;
    return (_a = this.settings.get(key)) == null ? void 0 : _a.value;
  }
  /**
   * Set data to this.settings, 
   * but do not save it to the configuration file
   * @param key key name
   * @param value value
   */
  set(key, value) {
    let item = this.settings.get(key);
    if (item) {
      item.value = value;
      this.updateElementFromValue(key);
    }
  }
  /**
   * Set and save setting item value
   * If you want to set and save immediately you can use this method
   * @param key key name
   * @param value value
   */
  async setAndSave(key, value) {
    let item = this.settings.get(key);
    if (item) {
      item.value = value;
      this.updateElementFromValue(key);
      await this.save();
    }
  }
  /**
    * Read in the value of element instead of setting obj in real time
    * @param key key name
    * @param apply whether to apply the value to the setting object
    *        if true, the value will be applied to the setting object
    * @returns value in html
    */
  take(key, apply = false) {
    let item = this.settings.get(key);
    let element = this.elements.get(key);
    if (!element) {
      return;
    }
    if (apply) {
      this.updateValueFromElement(key);
    }
    return item.getEleVal(element);
  }
  /**
   * Read data from html and save it
   * @param key key name
   * @param value value
   * @return value in html
   */
  async takeAndSave(key) {
    let value = this.take(key, true);
    await this.save();
    return value;
  }
  /**
   * Disable setting item
   * @param key key name
   */
  disable(key) {
    let element = this.elements.get(key);
    if (element) {
      element.disabled = true;
    }
  }
  /**
   * Enable setting item
   * @param key key name
   */
  enable(key) {
    let element = this.elements.get(key);
    if (element) {
      element.disabled = false;
    }
  }
  /**
   * 将设置项目导出为 JSON 对象
   * @returns object
   */
  dump() {
    let data = {};
    for (let [key, item] of this.settings) {
      if (item.type === "button") continue;
      data[key] = item.value;
    }
    return data;
  }
  addItem(item) {
    this.settings.set(item.key, item);
    const IsCustom = item.type === "custom";
    let error = IsCustom && (item.createElement === void 0 || item.getEleVal === void 0 || item.setEleVal === void 0);
    if (error) {
      console.error("The custom setting item must have createElement, getEleVal and setEleVal methods");
      return;
    }
    if (item.getEleVal === void 0) {
      item.getEleVal = createDefaultGetter(item.type);
    }
    if (item.setEleVal === void 0) {
      item.setEleVal = createDefaultSetter(item.type);
    }
    if (item.createElement === void 0) {
      let itemElement = this.createDefaultElement(item);
      this.elements.set(item.key, itemElement);
      this.plugin.setting.addItem({
        title: item.title,
        description: item == null ? void 0 : item.description,
        direction: item == null ? void 0 : item.direction,
        createActionElement: () => {
          this.updateElementFromValue(item.key);
          let element = this.getElement(item.key);
          return element;
        }
      });
    } else {
      this.plugin.setting.addItem({
        title: item.title,
        description: item == null ? void 0 : item.description,
        direction: item == null ? void 0 : item.direction,
        createActionElement: () => {
          let val = this.get(item.key);
          let element = item.createElement(val);
          this.elements.set(item.key, element);
          return element;
        }
      });
    }
  }
  createDefaultElement(item) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i;
    let itemElement;
    const preventEnterConfirm = (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    switch (item.type) {
      case "checkbox":
        let element = document.createElement("input");
        element.type = "checkbox";
        element.checked = item.value;
        element.className = "b3-switch fn__flex-center";
        itemElement = element;
        element.onchange = ((_a = item.action) == null ? void 0 : _a.callback) ?? (() => {
        });
        break;
      case "select":
        let selectElement = document.createElement("select");
        selectElement.className = "b3-select fn__flex-center fn__size200";
        let options = (item == null ? void 0 : item.options) ?? {};
        for (let val in options) {
          let optionElement = document.createElement("option");
          let text = options[val];
          optionElement.value = val;
          optionElement.text = text;
          selectElement.appendChild(optionElement);
        }
        selectElement.value = item.value;
        selectElement.onchange = ((_b = item.action) == null ? void 0 : _b.callback) ?? (() => {
        });
        itemElement = selectElement;
        break;
      case "slider":
        let sliderElement = document.createElement("input");
        sliderElement.type = "range";
        sliderElement.className = "b3-slider fn__size200 b3-tooltips b3-tooltips__n";
        sliderElement.ariaLabel = item.value;
        sliderElement.min = ((_c = item.slider) == null ? void 0 : _c.min.toString()) ?? "0";
        sliderElement.max = ((_d = item.slider) == null ? void 0 : _d.max.toString()) ?? "100";
        sliderElement.step = ((_e = item.slider) == null ? void 0 : _e.step.toString()) ?? "1";
        sliderElement.value = item.value;
        sliderElement.onchange = () => {
          var _a2;
          sliderElement.ariaLabel = sliderElement.value;
          (_a2 = item.action) == null ? void 0 : _a2.callback();
        };
        itemElement = sliderElement;
        break;
      case "textinput":
        let textInputElement = document.createElement("input");
        textInputElement.className = "b3-text-field fn__flex-center fn__size200";
        textInputElement.value = item.value;
        textInputElement.onchange = ((_f = item.action) == null ? void 0 : _f.callback) ?? (() => {
        });
        itemElement = textInputElement;
        textInputElement.addEventListener("keydown", preventEnterConfirm);
        break;
      case "textarea":
        let textareaElement = document.createElement("textarea");
        textareaElement.className = "b3-text-field fn__block";
        textareaElement.value = item.value;
        textareaElement.onchange = ((_g = item.action) == null ? void 0 : _g.callback) ?? (() => {
        });
        itemElement = textareaElement;
        break;
      case "number":
        let numberElement = document.createElement("input");
        numberElement.type = "number";
        numberElement.className = "b3-text-field fn__flex-center fn__size200";
        numberElement.value = item.value;
        itemElement = numberElement;
        numberElement.addEventListener("keydown", preventEnterConfirm);
        break;
      case "button":
        let buttonElement = document.createElement("button");
        buttonElement.className = "b3-button b3-button--outline fn__flex-center fn__size200";
        buttonElement.innerText = ((_h = item.button) == null ? void 0 : _h.label) ?? "Button";
        buttonElement.onclick = ((_i = item.button) == null ? void 0 : _i.callback) ?? (() => {
        });
        itemElement = buttonElement;
        break;
      case "hint":
        let hintElement = document.createElement("div");
        hintElement.className = "b3-label fn__flex-center";
        itemElement = hintElement;
        break;
    }
    return itemElement;
  }
  /**
   * return the setting element
   * @param key key name
   * @returns element
   */
  getElement(key) {
    let element = this.elements.get(key);
    return element;
  }
  updateValueFromElement(key) {
    let item = this.settings.get(key);
    if (item.type === "button") return;
    let element = this.elements.get(key);
    item.value = item.getEleVal(element);
  }
  updateElementFromValue(key) {
    let item = this.settings.get(key);
    if (item.type === "button") return;
    let element = this.elements.get(key);
    item.setEleVal(element, item.value);
  }
}
const STORAGE_NAME = "git-sync-config";
class GitSyncPlugin extends siyuan.Plugin {
  constructor() {
    super(...arguments);
    this.config = {
      repoOwner: "",
      repoName: "",
      branch: "main",
      token: "",
      authorName: "SiYuan User",
      authorEmail: "user@siyuan.local",
      autoSync: false,
      syncInterval: 30
    };
    this.syncIntervalId = null;
    this.isSyncing = false;
    this.fileCache = /* @__PURE__ */ new Map();
  }
  async onload() {
    console.log("Loading Git Sync Plugin");
    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME
    });
    this.registerSettings();
    await this.loadConfig();
    this.addTopBarIcon();
    if (this.config.autoSync && this.isConfigValid()) {
      this.startAutoSync();
    }
    siyuan.showMessage("✅ Git Sync Plugin Loaded", 2e3, "info");
  }
  onunload() {
    console.log("Unloading Git Sync Plugin");
    this.stopAutoSync();
  }
  onLayoutReady() {
    console.log("Layout ready for Git Sync Plugin");
  }
  async loadConfig() {
    try {
      const savedConfig = await this.loadData(STORAGE_NAME);
      if (savedConfig) {
        const parsed = typeof savedConfig === "string" ? JSON.parse(savedConfig) : savedConfig;
        this.config = { ...this.config, ...parsed };
        console.log("Config loaded successfully");
      }
    } catch (e) {
      console.error("Failed to load config:", e);
    }
  }
  async saveConfig() {
    await this.saveData(STORAGE_NAME, JSON.stringify(this.config, null, 2));
    if (this.config.autoSync && this.isConfigValid()) {
      this.startAutoSync();
    } else {
      this.stopAutoSync();
    }
    siyuan.showMessage("✅ Configuration saved", 2e3, "info");
  }
  addTopBarIcon() {
    this.topBarElement = this.addTopBar({
      icon: "iconCloud",
      title: "Git Sync",
      position: "right",
      callback: () => {
        this.showMenu();
      }
    });
  }
  isConfigValid() {
    return !!(this.config.repoOwner && this.config.repoName && this.config.branch && this.config.token);
  }
  showError(message, error) {
    console.error(message, error);
    let errorMsg = `❌ ${message}`;
    if (error == null ? void 0 : error.message) {
      errorMsg += `
${error.message}`;
    }
    siyuan.showMessage(errorMsg, 6e3, "error");
  }
  // GitHub API Methods
  async githubRequest(endpoint, method = "GET", body) {
    const url = `https://api.github.com${endpoint}`;
    const headers = {
      "Authorization": `Bearer ${this.config.token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "SiYuan-Git-Sync-Plugin"
    };
    const options = {
      method,
      headers
    };
    if (body) {
      options.body = JSON.stringify(body);
    }
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `GitHub API Error (${response.status})`;
        if (response.status === 401) {
          errorMsg += ": Invalid token or authentication failed";
        } else if (response.status === 403) {
          errorMsg += ": Access forbidden - check token permissions";
        } else if (response.status === 404) {
          errorMsg += ": Repository not found or no access";
        } else {
          errorMsg += `: ${errorText}`;
        }
        throw new Error(errorMsg);
      }
      if (response.status === 204) {
        return null;
      }
      return await response.json();
    } catch (error) {
      if (error.message.includes("Failed to fetch")) {
        throw new Error("Network error - check your internet connection");
      }
      throw error;
    }
  }
  async testConnection() {
    if (!this.isConfigValid()) {
      siyuan.showMessage("⚠️ Please configure all required settings first", 3e3, "error");
      return;
    }
    siyuan.showMessage("🔍 Testing connection...", 2e3, "info");
    try {
      const repo = await this.githubRequest(
        `/repos/${this.config.repoOwner}/${this.config.repoName}`
      );
      siyuan.showMessage(`✅ Connected to: ${repo.full_name}`, 3e3, "info");
    } catch (error) {
      this.showError("Connection test failed", error);
    }
  }
  async getGitHubTree(sha) {
    try {
      let treeSha = sha;
      if (!treeSha) {
        const ref = await this.githubRequest(
          `/repos/${this.config.repoOwner}/${this.config.repoName}/git/refs/heads/${this.config.branch}`
        );
        const commit = await this.githubRequest(ref.object.url.replace("https://api.github.com", ""));
        treeSha = commit.tree.sha;
      }
      const tree = await this.githubRequest(
        `/repos/${this.config.repoOwner}/${this.config.repoName}/git/trees/${treeSha}?recursive=1`
      );
      return tree.tree || [];
    } catch (error) {
      if (error.message.includes("404")) {
        return [];
      }
      throw error;
    }
  }
  async getFileContent(path) {
    try {
      const data = await this.githubRequest(
        `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}?ref=${this.config.branch}`
      );
      if (data.type === "file" && data.content) {
        return atob(data.content.replace(/\n/g, ""));
      }
    } catch (error) {
      if (error.message.includes("404")) {
        return null;
      }
      throw error;
    }
    return null;
  }
  async createOrUpdateFile(path, content, sha) {
    const message = sha ? `Update ${path} from SiYuan` : `Create ${path} from SiYuan`;
    const body = {
      message: `${message} - ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: this.config.branch,
      committer: {
        name: this.config.authorName,
        email: this.config.authorEmail
      },
      author: {
        name: this.config.authorName,
        email: this.config.authorEmail
      }
    };
    if (sha) {
      body.sha = sha;
    }
    await this.githubRequest(
      `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}`,
      "PUT",
      body
    );
  }
  async deleteFile(path, sha) {
    const body = {
      message: `Delete ${path} from SiYuan - ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      sha,
      branch: this.config.branch,
      committer: {
        name: this.config.authorName,
        email: this.config.authorEmail
      }
    };
    await this.githubRequest(
      `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}`,
      "DELETE",
      body
    );
  }
  // SiYuan API Methods
  async listNotebooks() {
    var _a;
    try {
      const response = await fetch("/api/notebook/lsNotebooks", {
        method: "POST"
      });
      const data = await response.json();
      return ((_a = data.data) == null ? void 0 : _a.notebooks) || [];
    } catch (error) {
      console.error("Failed to list notebooks:", error);
      return [];
    }
  }
  async listDocsByPath(notebookId, path) {
    var _a;
    try {
      const response = await fetch("/api/filetree/listDocsByPath", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook: notebookId, path })
      });
      const data = await response.json();
      const files = ((_a = data.data) == null ? void 0 : _a.files) || [];
      let allFiles = [...files];
      for (const file of files) {
        if (file.subFileCount > 0) {
          const subFiles = await this.listDocsByPath(notebookId, file.path);
          allFiles = allFiles.concat(subFiles);
        }
      }
      return allFiles;
    } catch (error) {
      console.error("Failed to list docs:", error);
      return [];
    }
  }
  async exportMarkdown(docId) {
    var _a;
    try {
      const response = await fetch("/api/export/exportMdContent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: docId })
      });
      const data = await response.json();
      return ((_a = data.data) == null ? void 0 : _a.content) || "";
    } catch (error) {
      console.error("Failed to export markdown:", error);
      return "";
    }
  }
  async createNotebook(name) {
    var _a;
    try {
      const response = await fetch("/api/notebook/createNotebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      return (_a = data.data) == null ? void 0 : _a.notebook;
    } catch (error) {
      console.error("Failed to create notebook:", error);
      return null;
    }
  }
  async createDocWithMd(notebookId, path, markdown) {
    try {
      const response = await fetch("/api/filetree/createDocWithMd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          notebook: notebookId,
          path,
          markdown
        })
      });
      return await response.json();
    } catch (error) {
      console.error("Failed to create document:", error);
      return null;
    }
  }
  async getLocalFiles() {
    const localFiles = [];
    const notebooks = await this.listNotebooks();
    for (const notebook of notebooks) {
      const files = await this.listDocsByPath(notebook.id, "/");
      for (const file of files) {
        if (file.path && file.path.endsWith(".sy")) {
          const content = await this.exportMarkdown(file.id);
          const relativePath = file.path.replace(/^\//, "").replace(/\.sy$/, ".md");
          localFiles.push({
            notebook: notebook.name,
            path: `${notebook.name}/${relativePath}`,
            content,
            id: file.id
          });
        }
      }
    }
    return localFiles;
  }
  async pushToGitHub() {
    if (!this.isConfigValid()) {
      siyuan.showMessage("⚠️ Please configure settings first", 3e3, "error");
      return;
    }
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    this.isSyncing = true;
    siyuan.showMessage("📤 Pushing to GitHub...", 3e3, "info");
    try {
      const localFiles = await this.getLocalFiles();
      const githubTree = await this.getGitHubTree();
      const githubFiles = /* @__PURE__ */ new Map();
      for (const item of githubTree) {
        if (item.type === "blob") {
          githubFiles.set(item.path, item);
        }
      }
      let uploaded = 0;
      let updated = 0;
      let errors = 0;
      for (const localFile of localFiles) {
        try {
          const githubFile = githubFiles.get(localFile.path);
          if (githubFile) {
            const existingContent = await this.getFileContent(localFile.path);
            if (existingContent !== localFile.content) {
              await this.createOrUpdateFile(localFile.path, localFile.content, githubFile.sha);
              updated++;
            }
          } else {
            await this.createOrUpdateFile(localFile.path, localFile.content);
            uploaded++;
          }
          githubFiles.delete(localFile.path);
        } catch (error) {
          console.error(`Failed to sync ${localFile.path}:`, error);
          errors++;
        }
      }
      const message = `✅ Push complete
📤 Uploaded: ${uploaded}
🔄 Updated: ${updated}` + (errors > 0 ? `
❌ Errors: ${errors}` : "");
      siyuan.showMessage(message, 5e3, "info");
    } catch (error) {
      this.showError("Push failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async pullFromGitHub() {
    if (!this.isConfigValid()) {
      siyuan.showMessage("⚠️ Please configure settings first", 3e3, "error");
      return;
    }
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    this.isSyncing = true;
    siyuan.showMessage("📥 Pulling from GitHub...", 3e3, "info");
    try {
      const githubTree = await this.getGitHubTree();
      const notebooks = await this.listNotebooks();
      const notebookMap = new Map(notebooks.map((nb) => [nb.name, nb]));
      let created = 0;
      let updated = 0;
      let errors = 0;
      for (const item of githubTree) {
        if (item.type !== "blob" || !item.path.endsWith(".md")) {
          continue;
        }
        try {
          const parts = item.path.split("/");
          const notebookName = parts[0];
          const filePath = "/" + parts.slice(1).join("/").replace(/\.md$/, "");
          let notebook = notebookMap.get(notebookName);
          if (!notebook) {
            notebook = await this.createNotebook(notebookName);
            if (notebook) {
              notebookMap.set(notebookName, notebook);
            } else {
              console.error(`Failed to create notebook: ${notebookName}`);
              errors++;
              continue;
            }
          }
          const content = await this.getFileContent(item.path);
          if (content === null) {
            console.error(`Failed to get content for: ${item.path}`);
            errors++;
            continue;
          }
          const result = await this.createDocWithMd(notebook.id, filePath, content);
          if ((result == null ? void 0 : result.code) === 0) {
            created++;
          } else {
            errors++;
          }
        } catch (error) {
          console.error(`Failed to sync ${item.path}:`, error);
          errors++;
        }
      }
      const message = `✅ Pull complete
📥 Downloaded: ${created}` + (errors > 0 ? `
❌ Errors: ${errors}` : "");
      siyuan.showMessage(message, 5e3, "info");
    } catch (error) {
      this.showError("Pull failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async fullSync() {
    if (!this.isConfigValid()) {
      siyuan.showMessage("⚠️ Please configure settings first", 3e3, "error");
      return;
    }
    if (this.isSyncing) {
      siyuan.showMessage("⏳ Sync already in progress", 2e3, "info");
      return;
    }
    siyuan.showMessage("🔄 Starting full sync...", 3e3, "info");
    try {
      this.isSyncing = true;
      await this.pullFromGitHub();
      await this.pushToGitHub();
      siyuan.showMessage("✅ Full sync completed", 3e3, "info");
    } catch (error) {
      this.showError("Full sync failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async showStatus() {
    if (!this.isConfigValid()) {
      siyuan.showMessage("⚠️ Please configure settings first", 3e3, "error");
      return;
    }
    siyuan.showMessage("📊 Checking status...", 2e3, "info");
    try {
      const localFiles = await this.getLocalFiles();
      const githubTree = await this.getGitHubTree();
      const githubMdFiles = githubTree.filter(
        (item) => item.type === "blob" && item.path.endsWith(".md")
      );
      const notebooks = await this.listNotebooks();
      const statusMsg = `📊 Status:

📚 Local notebooks: ${notebooks.length}
📄 Local files: ${localFiles.length}
☁️ GitHub files: ${githubMdFiles.length}
🔗 Repository: ${this.config.repoOwner}/${this.config.repoName}
🌿 Branch: ${this.config.branch}`;
      siyuan.showMessage(statusMsg, 8e3, "info");
    } catch (error) {
      this.showError("Failed to get status", error);
    }
  }
  startAutoSync() {
    this.stopAutoSync();
    const intervalMs = Math.max(this.config.syncInterval, 5) * 60 * 1e3;
    this.syncIntervalId = window.setInterval(async () => {
      if (!this.isSyncing && this.isConfigValid()) {
        console.log("⏰ Auto-sync triggered");
        await this.fullSync();
      }
    }, intervalMs);
    console.log(`✅ Auto-sync started: every ${this.config.syncInterval} minutes`);
  }
  stopAutoSync() {
    if (this.syncIntervalId) {
      clearInterval(this.syncIntervalId);
      this.syncIntervalId = null;
    }
  }
  registerSettings() {
    this.settingUtils.addItem({
      key: "repoOwner",
      value: this.config.repoOwner,
      type: "textinput",
      title: "Repository Owner",
      description: "GitHub username or organization (e.g., 'octocat')",
      action: {
        callback: () => {
          const value = this.settingUtils.take("repoOwner");
          if (value !== void 0) {
            this.config.repoOwner = String(value).trim();
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "repoName",
      value: this.config.repoName,
      type: "textinput",
      title: "Repository Name",
      description: "Repository name (e.g., 'my-notes')",
      action: {
        callback: () => {
          const value = this.settingUtils.take("repoName");
          if (value !== void 0) {
            this.config.repoName = String(value).trim();
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "branch",
      value: this.config.branch,
      type: "textinput",
      title: "Branch",
      description: "Git branch (default: main)",
      action: {
        callback: () => {
          const value = this.settingUtils.take("branch");
          if (value !== void 0) {
            this.config.branch = String(value).trim() || "main";
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "token",
      value: this.config.token,
      type: "textinput",
      title: "GitHub Token",
      description: "Personal Access Token with 'repo' permissions",
      action: {
        callback: () => {
          const value = this.settingUtils.take("token");
          if (value !== void 0) {
            this.config.token = String(value).trim();
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "authorName",
      value: this.config.authorName,
      type: "textinput",
      title: "Author Name",
      description: "Name for Git commits",
      action: {
        callback: () => {
          const value = this.settingUtils.take("authorName");
          if (value !== void 0) {
            this.config.authorName = String(value);
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "authorEmail",
      value: this.config.authorEmail,
      type: "textinput",
      title: "Author Email",
      description: "Email for Git commits",
      action: {
        callback: () => {
          const value = this.settingUtils.take("authorEmail");
          if (value !== void 0) {
            this.config.authorEmail = String(value);
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "autoSync",
      value: this.config.autoSync,
      type: "checkbox",
      title: "Enable Auto-Sync",
      description: "Automatically sync at intervals",
      action: {
        callback: () => {
          const value = this.settingUtils.take("autoSync");
          if (value !== void 0) {
            this.config.autoSync = Boolean(value);
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "syncInterval",
      value: this.config.syncInterval,
      type: "number",
      title: "Sync Interval (minutes)",
      description: "Minutes between syncs (min 5)",
      action: {
        callback: () => {
          const value = this.settingUtils.take("syncInterval");
          if (value !== void 0) {
            this.config.syncInterval = Math.max(5, Number(value));
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "testButton",
      value: "",
      type: "button",
      title: "Test Connection",
      description: "Test GitHub connection",
      button: {
        label: "🔍 Test",
        callback: () => {
          this.testConnection();
        }
      }
    });
    try {
      this.settingUtils.load();
    } catch (error) {
      console.error("Error loading settings:", error);
    }
  }
  async openSetting() {
    const settingPanel = this.setting;
    if (settingPanel) {
      settingPanel.open(STORAGE_NAME);
    }
  }
  showMenu() {
    const menu = new siyuan.Menu("gitSyncMenu");
    menu.addItem({
      icon: "iconSettings",
      label: "⚙️ Settings",
      click: () => {
        this.openSetting();
      }
    });
    menu.addSeparator();
    menu.addItem({
      icon: "iconRefresh",
      label: "🔄 Full Sync",
      click: () => {
        this.fullSync();
      }
    });
    menu.addItem({
      icon: "iconDownload",
      label: "📥 Pull from GitHub",
      click: () => {
        this.pullFromGitHub();
      }
    });
    menu.addItem({
      icon: "iconUpload",
      label: "📤 Push to GitHub",
      click: () => {
        this.pushToGitHub();
      }
    });
    menu.addSeparator();
    menu.addItem({
      icon: "iconInfo",
      label: "📊 Status",
      click: () => {
        this.showStatus();
      }
    });
    menu.addItem({
      icon: "iconTest",
      label: "🔍 Test Connection",
      click: () => {
        this.testConnection();
      }
    });
    const rect = this.topBarElement.getBoundingClientRect();
    menu.open({
      x: rect.left,
      y: rect.bottom,
      isLeft: true
    });
  }
}
module.exports = GitSyncPlugin;
