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
      syncInterval: 30,
      syncConfig: true,
      syncPlugins: false,
      syncTemplates: false
    };
    this.syncIntervalId = null;
    this.isSyncing = false;
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
  async githubRequest(endpoint, method = "GET", body) {
    const url = `https://api.github.com${endpoint}`;
    const headers = {
      "Authorization": `Bearer ${this.config.token}`,
      "Accept": "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "SiYuan-Git-Sync-Plugin"
    };
    const options = { method, headers };
    if (body) {
      options.body = JSON.stringify(body);
    }
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorText = await response.text();
        let errorMsg = `GitHub API Error (${response.status})`;
        if (response.status === 401) {
          errorMsg += ": Invalid token";
        } else if (response.status === 403) {
          errorMsg += ": Access forbidden";
        } else if (response.status === 404) {
          errorMsg += ": Not found";
        } else {
          errorMsg += `: ${errorText}`;
        }
        throw new Error(errorMsg);
      }
      if (response.status === 204) return null;
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
        try {
          const ref = await this.githubRequest(
            `/repos/${this.config.repoOwner}/${this.config.repoName}/git/refs/heads/${this.config.branch}`
          );
          const commit = await this.githubRequest(ref.object.url.replace("https://api.github.com", ""));
          treeSha = commit.tree.sha;
        } catch (error) {
          if (error.message.includes("404")) {
            console.log("Branch not found or empty, returning empty tree");
            return [];
          }
          throw error;
        }
      }
      if (treeSha === "4b825dc642cb6eb9a060e54bf8d69288fbee4904") {
        console.log("Empty tree detected, returning empty array");
        return [];
      }
      const tree = await this.githubRequest(
        `/repos/${this.config.repoOwner}/${this.config.repoName}/git/trees/${treeSha}?recursive=1`
      );
      return tree.tree || [];
    } catch (error) {
      if (error.message.includes("404") || error.message.includes("Not Found")) {
        console.log("Tree not found, returning empty array");
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
        return {
          content: atob(data.content.replace(/\n/g, "")),
          sha: data.sha
        };
      }
    } catch (error) {
      if (error.message.includes("404")) {
        return null;
      }
      throw error;
    }
    return null;
  }
  async readLocalFile(path) {
    try {
      const response = await fetch("/api/file/getFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });
      if (!response.ok) {
        console.error(`HTTP error reading ${path}: ${response.status} ${response.statusText}`);
        return null;
      }
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        const data = await response.json();
        console.log(`Read file response for ${path}:`, data);
        if ("ID" in data && "Spec" in data && "Type" in data) {
          try {
            return JSON.stringify(data, null, 2);
          } catch (stringifyError) {
            console.error(`Error stringifying direct content for ${path}:`, stringifyError);
            return null;
          }
        }
        if ("spec" in data && "id" in data || "keyValues" in data || "name" in data && "keyValues" in data) {
          try {
            return JSON.stringify(data, null, 2);
          } catch (stringifyError) {
            console.error(`Error stringifying config file for ${path}:`, stringifyError);
            return null;
          }
        }
        if (data.code === 0) {
          if (data.data !== void 0 && data.data !== null) {
            try {
              if (typeof data.data === "object") {
                if ("ID" in data.data && "Spec" in data.data && "Type" in data.data) {
                  return JSON.stringify(data.data, null, 2);
                } else {
                  return JSON.stringify(data.data, null, 2);
                }
              } else if (typeof data.data === "string") {
                return data.data;
              } else {
                return String(data.data);
              }
            } catch (stringifyError) {
              console.error(`Error stringifying data for ${path}:`, stringifyError);
              return null;
            }
          } else {
            return "";
          }
        } else {
          const errorMessage = data.msg || data.message || "Unknown error";
          console.error(`API error reading ${path}: ${errorMessage}`);
          return null;
        }
      } else {
        const content = await response.text();
        console.log(`Raw content read for ${path}: length ${content.length}`);
        return content;
      }
    } catch (error) {
      console.error(`Failed to read local file ${path}:`, error);
      return null;
    }
  }
  async writeLocalFile(path, content) {
    try {
      if (typeof content !== "string") {
        content = String(content);
      }
      const contentBlob = new Blob([content], { type: "text/plain" });
      const formData = new FormData();
      formData.append("path", path);
      formData.append("file", contentBlob, path.split("/").pop());
      formData.append("isDir", "false");
      const response = await fetch("/api/file/putFile", {
        method: "POST",
        // Don't set Content-Type header - let the browser set it with the boundary
        body: formData
      });
      const dataResponse = await response.json();
      if (dataResponse.code !== 0) {
        console.error(`API error writing ${path}:`, dataResponse.msg || dataResponse.message);
      }
      return dataResponse.code === 0;
    } catch (error) {
      console.error(`Failed to write local file ${path}:`, error);
      return false;
    }
  }
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
  async listNotebookFiles(notebookId, path = "/") {
    try {
      const dirPath = `/data/${notebookId}${path}`;
      console.log(`Listing files in: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing directory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for ${dirPath}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read directory ${dirPath}:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listNotebookFiles(notebookId, itemPath);
          allFiles = allFiles.concat(subFiles);
        } else if (item.name.endsWith(".sy")) {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/${notebookId}${itemPath}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list files in ${notebookId}${path}:`, error);
      return [];
    }
  }
  async listConfigFiles() {
    try {
      console.log(`Listing config files in: /data/storage/`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/data/storage/"
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing config directory: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for config:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read config directory:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listConfigSubDir(item.name);
          allFiles = allFiles.concat(subFiles);
        } else if (this.isConfigFile(item.name)) {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/storage/${item.name}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list config files:`, error);
      return [];
    }
  }
  async listConfigSubDir(dirName) {
    try {
      const dirPath = `/data/storage/${dirName}`;
      console.log(`Listing config subdirectory: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing config subdirectory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for config subdirectory ${dirPath}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read config subdirectory ${dirPath}:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${dirName}/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listConfigSubDir(`${dirName}/${item.name}`);
          allFiles = allFiles.concat(subFiles);
        } else if (this.isConfigFile(item.name)) {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/storage${itemPath}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list config subdirectory ${dirName}:`, error);
      return [];
    }
  }
  isConfigFile(filename) {
    const configExtensions = [".json", ".yaml", ".yml", ".conf", ".ini", ".txt"];
    return configExtensions.some((ext) => filename.endsWith(ext)) || filename === "appearance" || filename.includes("config") || filename.includes("layout") || filename.includes("query");
  }
  async listPlugins() {
    try {
      console.log(`Listing plugins in: /data/plugins/`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/data/plugins/"
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing plugins directory: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for plugins:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read plugins directory:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${item.name}`;
        if (item.isDir) {
          const pluginFiles = await this.listPluginFiles(item.name);
          allFiles = allFiles.concat(pluginFiles);
        } else {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/plugins/${item.name}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list plugins:`, error);
      return [];
    }
  }
  async listPluginFiles(pluginName) {
    try {
      const dirPath = `/data/plugins/${pluginName}`;
      console.log(`Listing plugin files: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing plugin directory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for plugin ${pluginName}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read plugin directory ${pluginName}:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${pluginName}/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listPluginFiles(`${pluginName}/${item.name}`);
          allFiles = allFiles.concat(subFiles);
        } else {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/plugins${itemPath}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list plugin files for ${pluginName}:`, error);
      return [];
    }
  }
  async listTemplates() {
    try {
      console.log(`Listing templates in: /data/templates/`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/data/templates/"
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing templates directory: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for templates:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read templates directory:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${item.name}`;
        if (item.isDir) {
          const templateFiles = await this.listTemplateFiles(item.name);
          allFiles = allFiles.concat(templateFiles);
        } else if (this.isTemplateFile(item.name)) {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/templates/${item.name}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list templates:`, error);
      return [];
    }
  }
  async listTemplateFiles(templateDirName) {
    try {
      const dirPath = `/data/templates/${templateDirName}`;
      console.log(`Listing template files: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing template directory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for template ${templateDirName}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read template directory ${templateDirName}:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = `/${templateDirName}/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listTemplateFiles(`${templateDirName}/${item.name}`);
          allFiles = allFiles.concat(subFiles);
        } else if (this.isTemplateFile(item.name)) {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/templates${itemPath}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list template files for ${templateDirName}:`, error);
      return [];
    }
  }
  isTemplateFile(filename) {
    return filename.endsWith(".md") || filename.endsWith(".tpl") || filename.endsWith(".template") || filename.endsWith(".sy") || filename.endsWith(".json");
  }
  async getLocalFiles() {
    const fileMap = /* @__PURE__ */ new Map();
    await this.addWorkspaceConfigFiles(fileMap);
    await this.addDataFiles(fileMap);
    console.log(`Total files to sync: ${fileMap.size}`);
    return fileMap;
  }
  async addWorkspaceConfigFiles(fileMap) {
    try {
      console.log(`Listing workspace config files in: /conf/`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/conf/"
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing workspace conf directory: ${response.status} ${response.statusText}`);
        return;
      }
      const data = await response.json();
      console.log(`readDir response for workspace conf:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read workspace conf directory:`, errorMessage);
        return;
      }
      for (const item of data.data || []) {
        if (item.isDir) {
          await this.addConfSubDir(item.name, "/conf/", "conf/", fileMap);
        } else {
          const localPath = `/conf/${item.name}`;
          const content = await this.readLocalFile(localPath);
          if (content !== null) {
            const relativePath = `conf/${item.name}`;
            fileMap.set(relativePath, content);
            console.log(`  Added workspace config: ${relativePath}`);
          } else {
            console.error(`  Failed to read workspace config: ${localPath}`);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list workspace config files:`, error);
    }
  }
  async addConfSubDir(dirName, basePath, relativePathPrefix, fileMap) {
    try {
      const dirPath = `${basePath}${dirName}`;
      console.log(`Listing conf subdirectory: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing conf subdirectory ${dirPath}: ${response.status} ${response.statusText}`);
        return;
      }
      const data = await response.json();
      console.log(`readDir response for conf subdirectory ${dirPath}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read conf subdirectory ${dirPath}:`, errorMessage);
        return;
      }
      for (const item of data.data || []) {
        const itemRelativePath = `${relativePathPrefix}${dirName}/${item.name}`;
        if (item.isDir) {
          await this.addConfSubDir(item.name, `${dirPath}/`, relativePathPrefix, fileMap);
        } else {
          const localPath = `${dirPath}/${item.name}`;
          const content = await this.readLocalFile(localPath);
          if (content !== null) {
            fileMap.set(itemRelativePath, content);
            console.log(`  Added conf sub file: ${itemRelativePath}`);
          } else {
            console.error(`  Failed to read conf sub file: ${localPath}`);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list conf subdirectory ${dirName}:`, error);
    }
  }
  async addDataFiles(fileMap) {
    try {
      console.log(`Listing data directory files in: /data/`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "/data/"
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing data directory: ${response.status} ${response.statusText}`);
        return;
      }
      const data = await response.json();
      console.log(`readDir response for data:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read data directory:`, errorMessage);
        return;
      }
      const specialDirs = ["storage", "plugins", "templates", "assets", "emojis", "snippets", "widgets", "public"];
      for (const item of data.data || []) {
        if (item.isDir && specialDirs.includes(item.name)) {
          switch (item.name) {
            case "storage":
              if (this.config.syncConfig) {
                await this.addDataSubDir("storage", "/data/", fileMap);
              }
              break;
            case "plugins":
              if (this.config.syncPlugins) {
                await this.addDataSubDir("plugins", "/data/", fileMap);
              }
              break;
            case "templates":
              if (this.config.syncTemplates) {
                await this.addDataSubDir("templates", "/data/", fileMap);
              }
              break;
            case "assets":
            case "emojis":
            case "snippets":
            case "widgets":
            case "public":
              await this.addDataSubDir(item.name, "/data/", fileMap);
              break;
            default:
              console.log(`Unknown special directory: ${item.name}`);
              await this.addDataSubDir(item.name, "/data/", fileMap);
          }
        }
      }
      for (const item of data.data || []) {
        if (item.isDir && !specialDirs.includes(item.name)) {
          await this.addNotebookFiles(item.name, fileMap);
        }
      }
    } catch (error) {
      console.error(`Failed to list data files:`, error);
    }
  }
  async addNotebookFiles(notebookName, fileMap) {
    try {
      const notebooks = await this.listNotebooks();
      const notebook = notebooks.find((nb) => nb.name === notebookName || nb.id === notebookName);
      if (!notebook) {
        console.error(`Notebook not found: ${notebookName}`);
        return;
      }
      const notebookId = notebook.id;
      console.log(`Processing notebook: ${notebookName} (${notebookId})`);
      const files = await this.listFiles("/data", notebookId);
      console.log(`  Found ${files.length} files in notebook ${notebookName}`);
      for (const file of files) {
        const content = await this.readLocalFile(file.fullPath);
        if (content !== null) {
          const relativePath = `data/${notebook.name}${file.path}`;
          fileMap.set(relativePath, content);
          console.log(`  Added: ${relativePath}`);
        } else {
          console.error(`  Failed to read: ${file.fullPath}`);
        }
      }
    } catch (error) {
      console.error(`Failed to process notebook ${notebookName}:`, error);
    }
  }
  // Improved file listing function with proper SiYuan directory structure handling
  async listFiles(basePath, notebookId, path = "/") {
    try {
      const dirPath = `${basePath}/${notebookId}${path}`;
      console.log(`Listing files in: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing directory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for ${dirPath}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read directory ${dirPath}:`, errorMessage);
        return [];
      }
      let allFiles = [];
      for (const item of data.data || []) {
        const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;
        if (item.isDir) {
          if (item.name === ".siyuan") {
            const configFiles = await this.listNotebookConfigFiles(notebookId, itemPath);
            allFiles = allFiles.concat(configFiles);
          } else {
            const subFiles = await this.listFiles(basePath, notebookId, itemPath);
            allFiles = allFiles.concat(subFiles);
          }
        } else {
          allFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `${basePath}/${notebookId}${itemPath}`
          });
        }
      }
      return allFiles;
    } catch (error) {
      console.error(`Failed to list files in ${basePath}/${notebookId}${path}:`, error);
      return [];
    }
  }
  async listNotebookConfigFiles(notebookId, path = "/") {
    try {
      const dirPath = `/data/${notebookId}${path}`;
      console.log(`Listing notebook config files in: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing notebook config directory ${dirPath}: ${response.status} ${response.statusText}`);
        return [];
      }
      const data = await response.json();
      console.log(`readDir response for notebook config ${dirPath}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read notebook config directory ${dirPath}:`, errorMessage);
        return [];
      }
      let configFiles = [];
      for (const item of data.data || []) {
        const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;
        if (item.isDir) {
          const subFiles = await this.listNotebookConfigFiles(notebookId, itemPath);
          configFiles = configFiles.concat(subFiles);
        } else {
          configFiles.push({
            name: item.name,
            path: itemPath,
            fullPath: `/data/${notebookId}${itemPath}`
          });
        }
      }
      return configFiles;
    } catch (error) {
      console.error(`Failed to list notebook config files in ${notebookId}${path}:`, error);
      return [];
    }
  }
  async addDataSubDir(dirName, basePath, fileMap) {
    try {
      const dirPath = `${basePath}${dirName}`;
      console.log(`Listing data subdirectory: ${dirPath}`);
      const response = await fetch("/api/file/readDir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: dirPath
        })
      });
      if (!response.ok) {
        console.error(`HTTP error listing data subdirectory ${dirPath}: ${response.status} ${response.statusText}`);
        return;
      }
      const data = await response.json();
      console.log(`readDir response for data subdirectory ${dirName}:`, data);
      if (data.code !== 0) {
        const errorMessage = data.msg || data.message || "Unknown error";
        console.error(`Failed to read data subdirectory ${dirName}:`, errorMessage);
        return;
      }
      for (const item of data.data || []) {
        const itemRelativePath = `${dirName}/${item.name}`;
        if (item.isDir) {
          await this.addDataSubDir(`${dirName}/${item.name}`, basePath, fileMap);
        } else {
          const localPath = `${dirPath}/${item.name}`;
          const content = await this.readLocalFile(localPath);
          if (content !== null) {
            fileMap.set(itemRelativePath, content);
            console.log(`  Added data sub file: ${itemRelativePath}`);
          } else {
            console.error(`  Failed to read data sub file: ${localPath}`);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to list data subdirectory ${dirName}:`, error);
    }
  }
  async createOrUpdateFile(path, content, sha) {
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existingFile = await this.getFileContent(path);
        fileSha = existingFile == null ? void 0 : existingFile.sha;
      } catch (error) {
        console.log(`File ${path} doesn't exist yet, will create it`);
      }
    }
    const message = fileSha ? `Update ${path}` : `Create ${path}`;
    let encodedContent;
    try {
      encodedContent = btoa(unescape(encodeURIComponent(content)));
    } catch (encodeError) {
      try {
        const binaryData = new TextEncoder().encode(content);
        encodedContent = btoa(String.fromCharCode(...binaryData));
      } catch (binaryError) {
        encodedContent = btoa(content);
      }
    }
    const body = {
      message: `${message} - ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      content: encodedContent,
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
    if (fileSha) {
      body.sha = fileSha;
    }
    await this.githubRequest(
      `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}`,
      "PUT",
      body
    );
  }
  async deleteFileFromGitHub(path, sha) {
    let fileSha = sha;
    if (!fileSha) {
      try {
        const existingFile = await this.getFileContent(path);
        fileSha = existingFile == null ? void 0 : existingFile.sha;
      } catch (error) {
        console.log(`File ${path} doesn't exist on GitHub, no need to delete`);
        return;
      }
    }
    if (!fileSha) {
      console.log(`Cannot delete ${path} - no SHA provided and could not retrieve it`);
      return;
    }
    const body = {
      message: `Delete ${path} - ${(/* @__PURE__ */ new Date()).toLocaleString()}`,
      sha: fileSha,
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
    await this.githubRequest(
      `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}`,
      "DELETE",
      body
    );
  }
  async deleteLocalFile(path) {
    try {
      const response = await fetch("/api/file/removeFile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path })
      });
      const data = await response.json();
      return data.code === 0;
    } catch (error) {
      console.error(`Failed to delete local file ${path}:`, error);
      return false;
    }
  }
  // Helper function to check if string is base64 encoded
  isBase64(str) {
    try {
      return btoa(atob(str)) === str;
    } catch (err) {
      return false;
    }
  }
  // Helper function to properly encode content as base64
  base64Encode(content) {
    try {
      return btoa(unescape(encodeURIComponent(content)));
    } catch (error) {
      try {
        const binaryData = new TextEncoder().encode(content);
        return btoa(String.fromCharCode(...binaryData));
      } catch (err) {
        return btoa(content);
      }
    }
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
      let skipped = 0;
      let deleted = 0;
      let errors = 0;
      for (const [path, content] of localFiles) {
        try {
          const githubFile = githubFiles.get(path);
          if (githubFile) {
            const remoteFile = await this.getFileContent(path);
            if (remoteFile && remoteFile.content === content) {
              skipped++;
              continue;
            }
            await this.createOrUpdateFile(path, content, remoteFile == null ? void 0 : remoteFile.sha);
            updated++;
          } else {
            await this.createOrUpdateFile(path, content);
            uploaded++;
          }
        } catch (error) {
          console.error(`Failed to sync ${path}:`, error);
          errors++;
        }
      }
      for (const [path, githubFile] of githubFiles) {
        if (!localFiles.has(path)) {
          if (path.endsWith(".sy") || path.startsWith("config/") || path.startsWith("plugins/") || path.startsWith("templates/")) {
            try {
              await this.deleteFileFromGitHub(path, githubFile.sha);
              deleted++;
            } catch (error) {
              console.error(`Failed to delete ${path} from GitHub:`, error);
              errors++;
            }
          }
        }
      }
      const message = `✅ Push complete
📤 Uploaded: ${uploaded}
🔄 Updated: ${updated}
🗑️ Deleted: ${deleted}
⏭️ Skipped: ${skipped}` + (errors > 0 ? `
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
      const result = await this.performPullOperation();
      const message = `✅ Pull complete
📥 Created: ${result.created}
🔄 Updated: ${result.updated}
🗑️ Deleted: ${result.deleted}
⏭️ Skipped: ${result.skipped}` + (result.errors > 0 ? `
❌ Errors: ${result.errors}` : "");
      siyuan.showMessage(message, 5e3, "info");
    } catch (error) {
      this.showError("Pull failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async performPullOperation() {
    const githubTree = await this.getGitHubTree();
    const localFiles = await this.getLocalFiles();
    const notebooks = await this.listNotebooks();
    const notebookMap = new Map(notebooks.map((nb) => [nb.name, nb]));
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let deleted = 0;
    let errors = 0;
    for (const item of githubTree) {
      if (item.type !== "blob") {
        continue;
      }
      try {
        const parts = item.path.split("/");
        const pathResult = await this.handlePullFileByType(item, parts, notebooks, notebookMap);
        if (pathResult) {
          if (pathResult.status === "created") created++;
          else if (pathResult.status === "updated") updated++;
          else if (pathResult.status === "skipped") skipped++;
          else if (pathResult.status === "error") errors++;
        } else {
          errors++;
        }
      } catch (error) {
        console.error(`Failed to sync ${item.path}:`, error);
        errors++;
      }
    }
    for (const [path, content] of localFiles) {
      const existsOnGitHub = githubTree.some(
        (item) => item.type === "blob" && item.path === path && (path.endsWith(".sy") || path.startsWith("config/") || path.startsWith("plugins/") || path.startsWith("templates/"))
      );
      if (!existsOnGitHub) {
        try {
          const pathParts = path.split("/");
          if (path.startsWith("notebooks/")) {
            if (pathParts.length >= 3) {
              const notebookName = pathParts[1];
              const notebook = notebookMap.get(notebookName);
              if (notebook) {
                const relativePath = "/" + pathParts.slice(2).join("/");
                const localPath = `/data/${notebook.id}${relativePath}`;
                if (await this.deleteLocalFile(localPath)) {
                  deleted++;
                } else {
                  console.error(`Failed to delete local file ${localPath}`);
                  errors++;
                }
              }
            }
          } else if (path.startsWith("config/")) {
            const relativePath = "/" + pathParts.slice(1).join("/");
            const localPath = `/data/storage${relativePath}`;
            if (await this.deleteLocalFile(localPath)) {
              deleted++;
            } else {
              console.error(`Failed to delete local config file ${localPath}`);
              errors++;
            }
          } else if (path.startsWith("plugins/")) {
            const relativePath = "/" + pathParts.slice(1).join("/");
            const localPath = `/data/plugins${relativePath}`;
            if (await this.deleteLocalFile(localPath)) {
              deleted++;
            } else {
              console.error(`Failed to delete local plugin file ${localPath}`);
              errors++;
            }
          } else if (path.startsWith("templates/")) {
            const relativePath = "/" + pathParts.slice(1).join("/");
            const localPath = `/data/templates${relativePath}`;
            if (await this.deleteLocalFile(localPath)) {
              deleted++;
            } else {
              console.error(`Failed to delete local template file ${localPath}`);
              errors++;
            }
          }
        } catch (error) {
          console.error(`Error deleting local file ${path}:`, error);
          errors++;
        }
      }
    }
    if (created > 0 || updated > 0 || deleted > 0) {
      await fetch("/api/filetree/refreshFiletree", { method: "POST" });
      await fetch("/api/filetree/renameDoc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebook: "", path: "/" })
      }).catch(() => {
      });
    }
    return { created, updated, skipped, deleted, errors };
  }
  async handlePullFileByType(item, parts, notebooks, notebookMap) {
    if (parts[0] === "notebooks") {
      const notebookName = parts[1];
      const relativePath = "/" + parts.slice(2).join("/");
      let notebook = notebookMap.get(notebookName);
      if (!notebook) {
        const matchingNotebook = notebooks.find((nb) => nb.name === notebookName || nb.id === notebookName);
        if (matchingNotebook) {
          notebook = matchingNotebook;
          notebookMap.set(notebookName, notebook);
        } else {
          const response = await fetch("/api/notebook/createNotebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: notebookName })
          });
          const data = await response.json();
          if (data.code === 0) {
            notebook = data.data.notebook;
            notebookMap.set(notebookName, notebook);
          } else {
            console.error(`Failed to create notebook ${notebookName}:`, data);
            return null;
          }
        }
      }
      const localPath = `/data/${notebook.id}${relativePath}`;
      const remoteFile = await this.getFileContent(item.path);
      if (!remoteFile) {
        return null;
      }
      const localContent = await this.readLocalFile(localPath);
      if (localContent !== null && localContent === remoteFile.content) {
        return { status: "skipped" };
      }
      const success = await this.writeLocalFile(localPath, remoteFile.content);
      if (success) {
        return { status: localContent === null ? "created" : "updated" };
      } else {
        console.error(`Failed to write local file ${localPath}`);
        return { status: "error" };
      }
    } else if (parts[0] === "config") {
      const relativePath = "/" + parts.slice(1).join("/");
      const localPath = `/data/storage${relativePath}`;
      const remoteFile = await this.getFileContent(item.path);
      if (!remoteFile) {
        return null;
      }
      const localContent = await this.readLocalFile(localPath);
      if (localContent !== null && localContent === remoteFile.content) {
        return { status: "skipped" };
      }
      const success = await this.writeLocalFile(localPath, remoteFile.content);
      if (success) {
        return { status: localContent === null ? "created" : "updated" };
      } else {
        console.error(`Failed to write local config file ${localPath}`);
        return { status: "error" };
      }
    } else if (parts[0] === "plugins") {
      const relativePath = "/" + parts.slice(1).join("/");
      const localPath = `/data/plugins${relativePath}`;
      const remoteFile = await this.getFileContent(item.path);
      if (!remoteFile) {
        return null;
      }
      const localContent = await this.readLocalFile(localPath);
      if (localContent !== null && localContent === remoteFile.content) {
        return { status: "skipped" };
      }
      const success = await this.writeLocalFile(localPath, remoteFile.content);
      if (success) {
        return { status: localContent === null ? "created" : "updated" };
      } else {
        console.error(`Failed to write local plugin file ${localPath}`);
        return { status: "error" };
      }
    } else if (parts[0] === "templates") {
      const relativePath = "/" + parts.slice(1).join("/");
      const localPath = `/data/templates${relativePath}`;
      const remoteFile = await this.getFileContent(item.path);
      if (!remoteFile) {
        return null;
      }
      const localContent = await this.readLocalFile(localPath);
      if (localContent !== null && localContent === remoteFile.content) {
        return { status: "skipped" };
      }
      const success = await this.writeLocalFile(localPath, remoteFile.content);
      if (success) {
        return { status: localContent === null ? "created" : "updated" };
      } else {
        console.error(`Failed to write local template file ${localPath}`);
        return { status: "error" };
      }
    } else {
      const notebookName = parts[0];
      const relativePath = "/" + parts.slice(1).join("/");
      let notebook = notebookMap.get(notebookName);
      if (!notebook) {
        const matchingNotebook = notebooks.find((nb) => nb.name === notebookName || nb.id === notebookName);
        if (matchingNotebook) {
          notebook = matchingNotebook;
          notebookMap.set(notebookName, notebook);
        } else {
          const response = await fetch("/api/notebook/createNotebook", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: notebookName })
          });
          const data = await response.json();
          if (data.code === 0) {
            notebook = data.data.notebook;
            notebookMap.set(notebookName, notebook);
          } else {
            console.error(`Failed to create notebook ${notebookName}:`, data);
            return null;
          }
        }
      }
      const localPath = `/data/${notebook.id}${relativePath}`;
      const remoteFile = await this.getFileContent(item.path);
      if (!remoteFile) {
        return null;
      }
      const localContent = await this.readLocalFile(localPath);
      if (localContent !== null && localContent === remoteFile.content) {
        return { status: "skipped" };
      }
      const success = await this.writeLocalFile(localPath, remoteFile.content);
      if (success) {
        return { status: localContent === null ? "created" : "updated" };
      } else {
        console.error(`Failed to write local file ${localPath}`);
        return { status: "error" };
      }
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
    this.isSyncing = true;
    try {
      const pullResult = await this.performPullOperation();
      await new Promise((resolve) => setTimeout(resolve, 1e3));
      const pushResult = await this.performPushOperation();
      const message = `✅ Full sync completed
📥 Pulled: ${pullResult.created + pullResult.updated}
📤 Pushed: ${pushResult.totalProcessed}
🗑️ Deleted: ${pullResult.deleted}` + (pullResult.errors > 0 || pushResult.errors > 0 ? `
❌ Errors: ${pullResult.errors + pushResult.errors}` : "");
      siyuan.showMessage(message, 5e3, "info");
    } catch (error) {
      this.showError("Full sync failed", error);
    } finally {
      this.isSyncing = false;
    }
  }
  async performPushOperation() {
    const localFiles = await this.getLocalFiles();
    const githubTree = await this.getGitHubTree();
    const githubFiles = /* @__PURE__ */ new Map();
    for (const item of githubTree) {
      if (item.type === "blob") {
        githubFiles.set(item.path, item);
      }
    }
    let totalProcessed = 0;
    let errors = 0;
    for (const [path, content] of localFiles) {
      try {
        const githubFile = githubFiles.get(path);
        if (githubFile) {
          const remoteFile = await this.getFileContent(path);
          if (!remoteFile || remoteFile.content !== content) {
            await this.createOrUpdateFile(path, content, remoteFile == null ? void 0 : remoteFile.sha);
            totalProcessed++;
          }
        } else {
          await this.createOrUpdateFile(path, content);
          totalProcessed++;
        }
      } catch (error) {
        console.error(`Failed to sync ${path}:`, error);
        errors++;
      }
    }
    return { totalProcessed, errors };
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
      const githubSyFiles = githubTree.filter(
        (item) => item.type === "blob" && item.path.endsWith(".sy")
      );
      const notebooks = await this.listNotebooks();
      const statusMsg = `📊 Status:

📚 Local notebooks: ${notebooks.length}
📄 Local files: ${localFiles.size}
☁️ GitHub files: ${githubSyFiles.length}
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
      key: "syncConfig",
      value: this.config.syncConfig,
      type: "checkbox",
      title: "Sync Config Files",
      description: "Sync configuration files (default: true)",
      action: {
        callback: () => {
          const value = this.settingUtils.take("syncConfig");
          if (value !== void 0) {
            this.config.syncConfig = Boolean(value);
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "syncPlugins",
      value: this.config.syncPlugins,
      type: "checkbox",
      title: "Sync Plugins",
      description: "Sync installed plugins and their settings (default: false)",
      action: {
        callback: () => {
          const value = this.settingUtils.take("syncPlugins");
          if (value !== void 0) {
            this.config.syncPlugins = Boolean(value);
            this.saveConfig();
          }
        }
      }
    });
    this.settingUtils.addItem({
      key: "syncTemplates",
      value: this.config.syncTemplates,
      type: "checkbox",
      title: "Sync Templates",
      description: "Sync template files (default: false)",
      action: {
        callback: () => {
          const value = this.settingUtils.take("syncTemplates");
          if (value !== void 0) {
            this.config.syncTemplates = Boolean(value);
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
