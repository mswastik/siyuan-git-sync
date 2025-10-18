/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub using simple HTTP API approach
 * This version avoids isomorphic-git to prevent Buffer polyfill issues
 */

import { Plugin, showMessage, Menu } from "siyuan";
import { SettingUtils } from "./libs/setting-utils";

const STORAGE_NAME = "git-sync-config";

interface GitConfig {
    repoOwner: string;
    repoName: string;
    branch: string;
    token: string;
    authorName: string;
    authorEmail: string;
    autoSync: boolean;
    syncInterval: number;
}

interface GitHubFile {
    name: string;
    path: string;
    sha: string;
    size: number;
    url: string;
    html_url: string;
    git_url: string;
    download_url: string;
    type: string;
    content?: string;
}

interface GitHubTreeItem {
    path: string;
    mode: string;
    type: string;
    sha?: string;
    content?: string;
}

interface LocalFile {
    notebook: string;
    path: string;
    content: string;
    id: string;
}

export default class GitSyncPlugin extends Plugin {
    private config: GitConfig = {
        repoOwner: "",
        repoName: "",
        branch: "main",
        token: "",
        authorName: "SiYuan User",
        authorEmail: "user@siyuan.local",
        autoSync: false,
        syncInterval: 30
    };
    
    private topBarElement: HTMLElement;
    private syncIntervalId: number | null = null;
    private isSyncing = false;
    private settingUtils: SettingUtils;
    private fileCache: Map<string, GitHubFile> = new Map();

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
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
            }
        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    private async saveConfig() {
        await this.saveData(STORAGE_NAME, JSON.stringify(this.config, null, 2));
        
        if (this.config.autoSync && this.isConfigValid()) {
            this.startAutoSync();
        } else {
            this.stopAutoSync();
        }
        
        showMessage("✅ Configuration saved", 2000, "info");
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
        let errorMsg = `❌ ${message}`;
        if (error?.message) {
            errorMsg += `\n${error.message}`;
        }
        showMessage(errorMsg, 6000, "error");
    }

    // GitHub API Methods
    private async githubRequest(endpoint: string, method: string = "GET", body?: any): Promise<any> {
        const url = `https://api.github.com${endpoint}`;
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${this.config.token}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "SiYuan-Git-Sync-Plugin"
        };

        const options: RequestInit = {
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
        } catch (error: any) {
            if (error.message.includes("Failed to fetch")) {
                throw new Error("Network error - check your internet connection");
            }
            throw error;
        }
    }

    private async testConnection() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure all required settings first", 3000, "error");
            return;
        }

        showMessage("🔍 Testing connection...", 2000, "info");

        try {
            const repo = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}`
            );
            
            showMessage(`✅ Connected to: ${repo.full_name}`, 3000, "info");
        } catch (error) {
            this.showError("Connection test failed", error);
        }
    }

    private async getGitHubTree(sha?: string): Promise<GitHubTreeItem[]> {
        try {
            let treeSha = sha;
            
            if (!treeSha) {
                // Get the latest commit SHA
                const ref = await this.githubRequest(
                    `/repos/${this.config.repoOwner}/${this.config.repoName}/git/refs/heads/${this.config.branch}`
                );
                const commit = await this.githubRequest(ref.object.url.replace('https://api.github.com', ''));
                treeSha = commit.tree.sha;
            }

            // Get the tree recursively
            const tree = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}/git/trees/${treeSha}?recursive=1`
            );
            
            return tree.tree || [];
        } catch (error: any) {
            if (error.message.includes("404")) {
                // Branch might not exist yet
                return [];
            }
            throw error;
        }
    }

    private async getFileContent(path: string): Promise<string | null> {
        try {
            const data = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}?ref=${this.config.branch}`
            );
            
            if (data.type === "file" && data.content) {
                // Content is base64 encoded
                return atob(data.content.replace(/\n/g, ''));
            }
        } catch (error: any) {
            if (error.message.includes("404")) {
                return null;
            }
            throw error;
        }
        return null;
    }

    private async createOrUpdateFile(path: string, content: string, sha?: string): Promise<void> {
        const message = sha 
            ? `Update ${path} from SiYuan`
            : `Create ${path} from SiYuan`;
        
        const body: any = {
            message: `${message} - ${new Date().toLocaleString()}`,
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

    private async deleteFile(path: string, sha: string): Promise<void> {
        const body = {
            message: `Delete ${path} from SiYuan - ${new Date().toLocaleString()}`,
            sha: sha,
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
    private async listNotebooks(): Promise<any[]> {
        try {
            const response = await fetch("/api/notebook/lsNotebooks", {
                method: "POST"
            });
            const data = await response.json();
            return data.data?.notebooks || [];
        } catch (error) {
            console.error("Failed to list notebooks:", error);
            return [];
        }
    }

    private async listDocsByPath(notebookId: string, path: string): Promise<any[]> {
        try {
            const response = await fetch("/api/filetree/listDocsByPath", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notebook: notebookId, path })
            });
            const data = await response.json();
            
            const files = data.data?.files || [];
            let allFiles = [...files];
            
            // Recursively get files from subdirectories
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

    private async exportMarkdown(docId: string): Promise<string> {
        try {
            const response = await fetch("/api/export/exportMdContent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: docId })
            });
            const data = await response.json();
            return data.data?.content || "";
        } catch (error) {
            console.error("Failed to export markdown:", error);
            return "";
        }
    }

    private async createNotebook(name: string): Promise<any> {
        try {
            const response = await fetch("/api/notebook/createNotebook", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name })
            });
            const data = await response.json();
            return data.data?.notebook;
        } catch (error) {
            console.error("Failed to create notebook:", error);
            return null;
        }
    }

    private async createDocWithMd(notebookId: string, path: string, markdown: string): Promise<any> {
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

    private async getLocalFiles(): Promise<LocalFile[]> {
        const localFiles: LocalFile[] = [];
        const notebooks = await this.listNotebooks();
        
        for (const notebook of notebooks) {
            const files = await this.listDocsByPath(notebook.id, "/");
            
            for (const file of files) {
                if (file.path && file.path.endsWith(".sy")) {
                    const content = await this.exportMarkdown(file.id);
                    const relativePath = file.path.replace(/^\//, '').replace(/\.sy$/, '.md');
                    
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
            const localFiles = await this.getLocalFiles();
            const githubTree = await this.getGitHubTree();
            
            // Build a map of GitHub files
            const githubFiles = new Map<string, GitHubTreeItem>();
            for (const item of githubTree) {
                if (item.type === "blob") {
                    githubFiles.set(item.path, item);
                }
            }

            let uploaded = 0;
            let updated = 0;
            let errors = 0;

            // Upload/update local files
            for (const localFile of localFiles) {
                try {
                    const githubFile = githubFiles.get(localFile.path);
                    
                    if (githubFile) {
                        // File exists, check if we need to update
                        const existingContent = await this.getFileContent(localFile.path);
                        if (existingContent !== localFile.content) {
                            await this.createOrUpdateFile(localFile.path, localFile.content, githubFile.sha);
                            updated++;
                        }
                    } else {
                        // New file
                        await this.createOrUpdateFile(localFile.path, localFile.content);
                        uploaded++;
                    }
                    
                    // Remove from map so we can detect deleted files
                    githubFiles.delete(localFile.path);
                } catch (error) {
                    console.error(`Failed to sync ${localFile.path}:`, error);
                    errors++;
                }
            }

            // Delete files that exist on GitHub but not locally
            // (commented out for safety - enable if you want auto-delete)
            // for (const [path, file] of githubFiles) {
            //     try {
            //         await this.deleteFile(path, file.sha!);
            //     } catch (error) {
            //         console.error(`Failed to delete ${path}:`, error);
            //     }
            // }

            const message = `✅ Push complete\n` +
                `📤 Uploaded: ${uploaded}\n` +
                `🔄 Updated: ${updated}` +
                (errors > 0 ? `\n❌ Errors: ${errors}` : '');
            
            showMessage(message, 5000, "info");
        } catch (error) {
            this.showError("Push failed", error);
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
        showMessage("📥 Pulling from GitHub...", 3000, "info");

        try {
            const githubTree = await this.getGitHubTree();
            const notebooks = await this.listNotebooks();
            const notebookMap = new Map(notebooks.map((nb: any) => [nb.name, nb]));

            let created = 0;
            let updated = 0;
            let errors = 0;

            // Process each file from GitHub
            for (const item of githubTree) {
                if (item.type !== "blob" || !item.path.endsWith('.md')) {
                    continue;
                }

                try {
                    // Parse path: NotebookName/path/to/file.md
                    const parts = item.path.split('/');
                    const notebookName = parts[0];
                    const filePath = '/' + parts.slice(1).join('/').replace(/\.md$/, '');

                    // Ensure notebook exists
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

                    // Get file content from GitHub
                    const content = await this.getFileContent(item.path);
                    if (content === null) {
                        console.error(`Failed to get content for: ${item.path}`);
                        errors++;
                        continue;
                    }

                    // Create/update document in SiYuan
                    const result = await this.createDocWithMd(notebook.id, filePath, content);
                    if (result?.code === 0) {
                        created++;
                    } else {
                        errors++;
                    }
                } catch (error) {
                    console.error(`Failed to sync ${item.path}:`, error);
                    errors++;
                }
            }

            const message = `✅ Pull complete\n` +
                `📥 Downloaded: ${created}` +
                (errors > 0 ? `\n❌ Errors: ${errors}` : '');
            
            showMessage(message, 5000, "info");
        } catch (error) {
            this.showError("Pull failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async fullSync() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure settings first", 3000, "error");
            return;
        }
        
        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        showMessage("🔄 Starting full sync...", 3000, "info");

        try {
            this.isSyncing = true;
            await this.pullFromGitHub();
            await this.pushToGitHub();
            showMessage("✅ Full sync completed", 3000, "info");
        } catch (error) {
            this.showError("Full sync failed", error);
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
            const localFiles = await this.getLocalFiles();
            const githubTree = await this.getGitHubTree();
            const githubMdFiles = githubTree.filter(item => 
                item.type === "blob" && item.path.endsWith('.md')
            );

            const notebooks = await this.listNotebooks();
            
            const statusMsg = `📊 Status:\n\n` +
                `📚 Local notebooks: ${notebooks.length}\n` +
                `📄 Local files: ${localFiles.length}\n` +
                `☁️ GitHub files: ${githubMdFiles.length}\n` +
                `🔗 Repository: ${this.config.repoOwner}/${this.config.repoName}\n` +
                `🌿 Branch: ${this.config.branch}`;

            showMessage(statusMsg, 8000, "info");
        } catch (error) {
            this.showError("Failed to get status", error);
        }
    }

    private startAutoSync() {
        this.stopAutoSync();

        const intervalMs = Math.max(this.config.syncInterval, 5) * 60 * 1000;

        this.syncIntervalId = window.setInterval(async () => {
            if (!this.isSyncing && this.isConfigValid()) {
                console.log("⏰ Auto-sync triggered");
                await this.fullSync();
            }
        }, intervalMs);

        console.log(`✅ Auto-sync started: every ${this.config.syncInterval} minutes`);
    }

    private stopAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
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
            description: "Personal Access Token with 'repo' permissions",
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
            key: "authorName",
            value: this.config.authorName,
            type: "textinput",
            title: "Author Name",
            description: "Name for Git commits",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("authorName");
                    if (value !== undefined) {
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
                    if (value !== undefined) {
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
            description: "Minutes between syncs (min 5)",
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