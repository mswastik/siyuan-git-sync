/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub using GitHub API
 * This is a simplified approach that works within SiYuan's plugin constraints
 */

import { Plugin, showMessage, Menu } from "siyuan";
import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "git-sync-config";

interface GitConfig {
    repoOwner: string;
    repoName: string;
    branch: string;
    token: string;
    syncPath: string;
    autoSync: boolean;
    syncInterval: number;
}

interface GitHubFile {
    path: string;
    content: string;
    sha?: string;
}

export default class GitSyncPlugin extends Plugin {
    private config: GitConfig = {
        repoOwner: "",
        repoName: "",
        branch: "main",
        token: "",
        syncPath: "",
        autoSync: false,
        syncInterval: 30
    };
    
    private topBarElement: HTMLElement;
    private syncIntervalId: number | null = null;
    private isSyncing = false;
    private settingUtils: SettingUtils;

    async onload() {
        console.log("Loading Git Sync Plugin");
        
        // Initialize settings
        this.settingUtils = new SettingUtils({
            plugin: this,
            name: STORAGE_NAME
        });
        
        // Register settings
        this.registerSettings();
        
        // Load config
        await this.loadConfig();

        // Add top bar icon
        this.addTopBarIcon();

        // Start auto-sync if enabled
        if (this.config.autoSync && this.isConfigValid()) {
            this.startAutoSync();
        }

        showMessage("✅ Git Sync Plugin Loaded", 2000, "info");
    }

    onunload() {
        console.log("Unloading Git Sync Plugin");
        this.stopAutoSync();
    }

    onLayoutReady() {
        console.log("Layout ready for Git Sync Plugin");
    }

    private async loadConfig() {
        try {
            const savedConfig = await this.loadData(STORAGE_NAME);
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = { ...this.config, ...parsed };
                console.log("Config loaded:", { ...this.config, token: "***" });
            }
        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    private async saveConfig() {
        try {
            await this.saveData(STORAGE_NAME, JSON.stringify(this.config, null, 2));
            console.log("Config saved");
            
            // Restart auto-sync if needed
            if (this.config.autoSync && this.isConfigValid()) {
                this.startAutoSync();
            } else {
                this.stopAutoSync();
            }
            
            showMessage("✅ Configuration saved", 2000, "info");
        } catch (e) {
            console.error("Failed to save config:", e);
            showMessage("❌ Failed to save configuration", 3000, "error");
        }
    }

    private addTopBarIcon() {
        this.topBarElement = this.addTopBar({
            icon: "iconCloud",
            title: "Git Sync",
            position: "right",
            callback: () => {
                this.showMenu();
            }
        });
    }

    private isConfigValid(): boolean {
        return !!(
            this.config.repoOwner &&
            this.config.repoName &&
            this.config.branch &&
            this.config.token
        );
    }

    private showError(message: string, error?: any) {
        console.error(message, error);
        let errorMsg = message;
        if (error?.message) {
            errorMsg += `\n${error.message}`;
        }
        showMessage(errorMsg, 5000, "error");
    }

    // GitHub API Methods
    private async githubRequest(endpoint: string, method: string = "GET", body?: any) {
        const url = `https://api.github.com${endpoint}`;
        const headers: Record<string, string> = {
            "Authorization": `token ${this.config.token}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        };

        const options: RequestInit = {
            method,
            headers
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`GitHub API Error (${response.status}): ${errorText}`);
        }

        if (response.status === 204) {
            return null;
        }

        return await response.json();
    }

    private async testConnection() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure all required settings first", 3000, "error");
            return;
        }

        showMessage("🔍 Testing connection...", 2000, "info");

        try {
            // Test by getting repository info
            const repo = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}`
            );
            
            showMessage(`✅ Connected to: ${repo.full_name}`, 3000, "info");
        } catch (error) {
            this.showError("❌ Connection test failed", error);
        }
    }

    private async getFileFromGitHub(path: string): Promise<GitHubFile | null> {
        try {
            const data = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${path}?ref=${this.config.branch}`
            );
            
            if (data.type === "file") {
                // Content is base64 encoded
                const content = atob(data.content.replace(/\n/g, ''));
                return {
                    path: data.path,
                    content,
                    sha: data.sha
                };
            }
        } catch (error: any) {
            if (error.message.includes("404")) {
                return null; // File doesn't exist
            }
            throw error;
        }
        return null;
    }

    private async uploadFileToGitHub(path: string, content: string, sha?: string) {
        const message = `Update ${path} from SiYuan - ${new Date().toLocaleString()}`;
        
        const body: any = {
            message,
            content: btoa(unescape(encodeURIComponent(content))), // UTF-8 to base64
            branch: this.config.branch
        };

        if (sha) {
            body.sha = sha; // Required for updating existing files
        }

        await this.githubRequest(
            `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${path}`,
            "PUT",
            body
        );
    }

    private async listNotebooks() {
        try {
            const response = await fetch("/api/notebook/lsNotebooks", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                }
            });
            const data = await response.json();
            return data.data?.notebooks || [];
        } catch (error) {
            console.error("Failed to list notebooks:", error);
            return [];
        }
    }

    private async getNotebookFiles(notebookId: string) {
        try {
            const response = await fetch("/api/filetree/listDocsByPath", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    notebook: notebookId,
                    path: "/"
                })
            });
            const data = await response.json();
            return data.data?.files || [];
        } catch (error) {
            console.error("Failed to get notebook files:", error);
            return [];
        }
    }

    private async getDocContent(docId: string) {
        try {
            const response = await fetch("/api/export/exportMdContent", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    id: docId
                })
            });
            const data = await response.json();
            return data.data?.content || "";
        } catch (error) {
            console.error("Failed to get document content:", error);
            return "";
        }
    }

    private async pushToGitHub() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure settings first", 3000, "error");
            return;
        }

        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("📤 Pushing to GitHub...", 3000, "info");

        try {
            const notebooks = await this.listNotebooks();
            
            if (notebooks.length === 0) {
                showMessage("⚠️ No notebooks found", 3000, "error");
                return;
            }

            let uploadedCount = 0;

            for (const notebook of notebooks) {
                const files = await this.getNotebookFiles(notebook.id);
                
                for (const file of files) {
                    if (file.path.endsWith(".sy")) {
                        try {
                            const content = await this.getDocContent(file.id);
                            const fileName = file.path.replace(/\.sy$/, ".md");
                            const githubPath = `${notebook.name}/${fileName}`;
                            
                            // Get existing file SHA if it exists
                            const existingFile = await this.getFileFromGitHub(githubPath);
                            
                            await this.uploadFileToGitHub(
                                githubPath,
                                content,
                                existingFile?.sha
                            );
                            
                            uploadedCount++;
                            console.log(`Uploaded: ${githubPath}`);
                        } catch (error) {
                            console.error(`Failed to upload ${file.path}:`, error);
                        }
                    }
                }
            }

            showMessage(`✅ Pushed ${uploadedCount} file(s) to GitHub`, 3000, "info");
        } catch (error) {
            this.showError("❌ Push failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async pullFromGitHub() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure settings first", 3000, "error");
            return;
        }

        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("📥 Pull from GitHub is not fully implemented yet", 3000, "info");
        
        // Note: Pulling requires creating/updating documents in SiYuan
        // This is more complex and requires careful handling
        // For now, we'll just show a message
        
        try {
            showMessage("⚠️ Pull functionality coming soon!\nFor now, use push to backup your notes.", 5000, "info");
        } finally {
            this.isSyncing = false;
        }
    }

    private async showStatus() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure settings first", 3000, "error");
            return;
        }

        showMessage("📊 Checking status...", 2000, "info");

        try {
            const notebooks = await this.listNotebooks();
            let totalDocs = 0;

            for (const notebook of notebooks) {
                const files = await this.getNotebookFiles(notebook.id);
                totalDocs += files.filter((f: any) => f.path.endsWith(".sy")).length;
            }

            const repo = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}`
            );

            const statusMsg = `📊 Status:\n` +
                `📚 Local notebooks: ${notebooks.length}\n` +
                `📄 Local documents: ${totalDocs}\n` +
                `🔗 Repository: ${repo.full_name}\n` +
                `🌿 Branch: ${this.config.branch}`;

            showMessage(statusMsg, 8000, "info");
        } catch (error) {
            this.showError("❌ Failed to get status", error);
        }
    }

    private startAutoSync() {
        this.stopAutoSync();

        const intervalMs = Math.max(this.config.syncInterval, 5) * 60 * 1000;

        this.syncIntervalId = window.setInterval(async () => {
            if (!this.isSyncing && this.isConfigValid()) {
                console.log("⏰ Auto-sync triggered");
                await this.pushToGitHub();
            }
        }, intervalMs);

        console.log(`✅ Auto-sync started: every ${this.config.syncInterval} minutes`);
        showMessage(`✅ Auto-sync enabled (every ${this.config.syncInterval} min)`, 3000, "info");
    }

    private stopAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
            console.log("🛑 Auto-sync stopped");
        }
    }

    private registerSettings() {
        this.settingUtils.addItem({
            key: "repoOwner",
            value: this.config.repoOwner,
            type: "textinput",
            title: "Repository Owner",
            description: "GitHub username or organization (e.g., 'octocat')",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("repoOwner");
                    if (value !== undefined) {
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
                    if (value !== undefined) {
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
                    if (value !== undefined) {
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
            description: "Personal Access Token with 'repo' permissions. Get it from github.com/settings/tokens",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("token");
                    if (value !== undefined) {
                        this.config.token = String(value).trim();
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
            description: "Automatically backup to GitHub at specified intervals",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("autoSync");
                    if (value !== undefined) {
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
            description: "Minutes between automatic syncs (minimum 5)",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("syncInterval");
                    if (value !== undefined) {
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
            description: "Test GitHub connection and verify settings",
            button: {
                label: "🔍 Test Connection",
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
        // This opens the plugin settings panel
        const settingPanel = this.setting;
        if (settingPanel) {
            settingPanel.open(STORAGE_NAME);
        }
    }
    
    private showMenu() {
        const menu = new Menu("gitSyncMenu");
        
        menu.addItem({
            icon: "iconSettings",
            label: "⚙️ Settings",
            click: () => {
                this.openSetting();
            }
        });
        
        menu.addSeparator();
        
        menu.addItem({
            icon: "iconUpload",
            label: "📤 Push to GitHub",
            click: () => {
                this.pushToGitHub();
            }
        });
        
        menu.addItem({
            icon: "iconDownload",
            label: "📥 Pull from GitHub",
            disabled: true, // Disabled for now
            click: () => {
                this.pullFromGitHub();
            }
        });
        
        menu.addSeparator();
        
        menu.addItem({
            icon: "iconInfo",
            label: "📊 View Status",
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