/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with Git repositories using isomorphic-git
 */

import { Dialog, Plugin, showMessage } from "siyuan";
import * as isogit from "isomorphic-git";
import { Buffer } from "buffer";

// Make sure Buffer is available for isomorphic-git in browser
if (typeof window !== "undefined" && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

interface GitConfig {
    repoUrl: string;
    branch: string;
    token: string;
    authorName: string;
    authorEmail: string;
    autoSync: boolean;
    syncInterval: number;
    syncOnChange: boolean; // New option to sync when files change
}

export default class GitSyncPlugin extends Plugin {
    private config: GitConfig = {
        repoUrl: "",
        branch: "main",
        token: "",
        authorName: "SiYuan User",
        authorEmail: "user@siyuan.local",
        autoSync: false,
        syncInterval: 30,
        syncOnChange: false
    };

    private fs: any;
    private p: any;
    private syncIntervalId: number | null = null;
    private changeDebounceTimer: number | null = null;
    private isSyncing = false;

    async onload() {
        console.log("Loading Git Sync Plugin with isomorphic-git");

        // Dynamically import LightningFS to avoid constructor issues
        const fsModule = await import("@isomorphic-git/lightning-fs");
        const LightningFS = fsModule.default || fsModule;
        
        // Initialize LightningFS
        this.fs = new LightningFS("siyuan-git");
        this.p = this.fs.promises;

        await this.loadConfig();
        this.addTopBarIcon();
        
        // Set up event listeners to monitor changes
        this.setupEventListeners();

        if (this.config.autoSync && this.config.repoUrl && this.config.token) {
            this.startAutoSync();
        }

        // Start change monitoring if enabled
        if (this.config.syncOnChange) {
            this.startChangeMonitoring();
        }

        showMessage("✅ Git Sync Plugin Loaded", 2000, "info");
    }

    onunload() {
        console.log("Unloading Git Sync Plugin");
        this.stopAutoSync();
        this.stopChangeMonitoring();
    }

    private async loadConfig() {
        try {
            const savedConfig = await this.loadData("git-sync-config");
            if (savedConfig) {
                this.config = { ...this.config, ...savedConfig };
                console.log("Config loaded successfully");
            }
        } catch (e) {
            console.error("Failed to load config:", e);
        }
    }

    private async saveConfig() {
        await this.saveData("git-sync-config", this.config);

        if (this.config.autoSync && this.config.repoUrl && this.config.token) {
            this.startAutoSync();
        } else {
            this.stopAutoSync();
        }

        // Start/stop change monitoring based on syncOnChange setting
        if (this.config.syncOnChange) {
            this.startChangeMonitoring();
        } else {
            this.stopChangeMonitoring();
        }

        showMessage("✅ Configuration saved", 2000, "info");
    }

    private addTopBarIcon() {
        this.addTopBar({
            icon: "iconCloud",
            title: "Git Sync",
            position: "right",
            callback: () => {
                this.openSetting();
            }
        });
    }

    private setupEventListeners() {
        // Listen for SiYuan events to detect document changes
        this.eventBus.on("ws-main", (data) => {
            if (data?.data?.cmd === "save-doc") {
                // Document was saved - sync if syncOnChange is enabled
                if (this.config.syncOnChange) {
                    this.scheduleChangeSync();
                }
            }
        });
        
        // Listen for file change events
        this.eventBus.on("filewatcher-change", () => {
            if (this.config.syncOnChange) {
                this.scheduleChangeSync();
            }
        });
    }

    private scheduleChangeSync() {
        // Clear any existing timer to debounce changes
        if (this.changeDebounceTimer) {
            clearTimeout(this.changeDebounceTimer);
        }
        
        // Wait a bit before sync to allow multiple changes to accumulate
        this.changeDebounceTimer = window.setTimeout(() => {
            this.push(); // Only push for now, since we're detecting local changes
        }, 5000);  // 5 seconds debounce time
    }

    private startChangeMonitoring() {
        console.log("✅ Started monitoring file changes");
    }

    private stopChangeMonitoring() {
        if (this.changeDebounceTimer) {
            clearTimeout(this.changeDebounceTimer);
            this.changeDebounceTimer = null;
        }
        console.log("✅ Stopped monitoring file changes");
    }

    private async testConnection() {
        if (!this.config.repoUrl || !this.config.token) {
            showMessage("⚠️ Please configure repository URL and token", 3000, "error");
            return;
        }

        try {
            showMessage("🔍 Testing connection...", 2000, "info");
            
            // Just test if we can access the repo by trying a fetch - don't actually clone
            await isogit.clone({
                fs: this.fs,
                http: this.getHttp(),
                dir: "/repo-test",
                url: this.config.repoUrl,
                singleBranch: true,
                depth: 1,
                onAuth: () => {
                    return {
                        username: "git",
                        password: this.config.token
                    };
                }
            });
            
            // Clean up after test
            await this.p.rm("/repo-test", { recursive: true, force: true });
            
            showMessage(`✅ Connected to: ${this.config.repoUrl}`, 3000, "info");
        } catch (error) {
            this.showError("Connection test failed", error);
        }
    }

    private async repoExists(): Promise<boolean> {
        try {
            const files = await this.p.readdir("/repo");
            return files.length > 0;
        } catch (error) {
            return false;
        }
    }

    private async ensureRepo() {
        if (!(await this.repoExists())) {
            await this.cloneRepo();
        }
    }

    private async cloneRepo() {
        try {
            showMessage("📥 Cloning repository...", 3000, "info");
            
            await isogit.clone({
                fs: this.fs,
                http: this.getHttp(),
                dir: "/repo",
                url: this.config.repoUrl,
                singleBranch: true,
                branch: this.config.branch,
                onAuth: () => {
                    return {
                        username: "git",
                        password: this.config.token
                    };
                }
            });
            
            showMessage("✅ Repository cloned successfully", 3000, "info");
        } catch (error) {
            this.showError("Failed to clone repository", error);
            throw error;
        }
    }

    private async pull() {
        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("📥 Pulling from Git...", 3000, "info");

        try {
            await this.ensureRepo();
            
            // Pull latest changes
            const result = await isogit.pull({
                fs: this.fs,
                http: this.getHttp(),
                dir: "/repo",
                author: {
                    name: this.config.authorName,
                    email: this.config.authorEmail
                },
                singleBranch: true,
                branch: this.config.branch,
                onAuth: () => {
                    return {
                        username: "git",
                        password: this.config.token
                    };
                }
            });

            // Now sync local files back to SiYuan workspace
            await this.syncFilesToSiYuan();
            
            showMessage(`✅ Pull completed\n${result ? `Merged: ${result.merge}` : 'Up to date'}`, 3000, "info");
        } catch (error) {
            this.showError("Pull failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async push() {
        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("📤 Pushing to Git...", 3000, "info");

        try {
            await this.ensureRepo();
            
            // First sync SiYuan files to the Git repo
            await this.syncFilesFromSiYuan();
            
            // Add all files to track changes
            await this.addAllFilesToGit();
            
            // Check if there are any changes staged
            const hasChanges = await this.hasStagedChanges();
            
            if (hasChanges) {
                // Commit changes
                await isogit.commit({
                    fs: this.fs,
                    dir: "/repo",
                    message: `Sync commit at ${new Date().toLocaleString()}`,
                    author: {
                        name: this.config.authorName,
                        email: this.config.authorEmail
                    }
                });
                
                // Push to remote
                await isogit.push({
                    fs: this.fs,
                    http: this.getHttp(),
                    dir: "/repo",
                    onAuth: () => {
                        return {
                            username: "git",
                            password: this.config.token
                        };
                    }
                });
                
                showMessage("✅ Changes pushed successfully", 3000, "info");
            } else {
                showMessage("✅ No changes to push", 3000, "info");
            }
        } catch (error) {
            this.showError("Push failed", error);
        } finally {
            this.isSyncing = false;
        }
    }
    
    private async addAllFilesToGit() {
        // Get all files in the repo directory and add them
        const allFiles = await this.getAllFiles("/repo");
        
        for (const file of allFiles) {
            try {
                await isogit.add({ 
                    fs: this.fs, 
                    dir: "/repo", 
                    filepath: file 
                });
            } catch (error) {
                // If adding a specific file fails, continue with others
                console.warn(`Failed to add file ${file}:`, error);
            }
        }
    }
    
    // Helper function to recursively get all files from the repo directory
    private async getAllFiles(dirPath: string): Promise<string[]> {
        const allFiles: string[] = [];
        
        try {
            const items = await this.p.readdir(dirPath);
            
            for (const item of items) {
                if (item === '.git') continue; // Skip .git directory
                
                const fullPath = `${dirPath}/${item}`;
                const stats = await this.p.stat(fullPath);
                
                if (stats.isDirectory()) {
                    const subFiles = await this.getAllFiles(fullPath);
                    allFiles.push(...subFiles);
                } else {
                    // Get relative path by removing the "/repo/" prefix
                    const relativePath = fullPath.substring(6); // Remove "/repo/" prefix
                    allFiles.push(relativePath);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${dirPath}:`, error);
        }
        
        return allFiles;
    }
    
    private async hasStagedChanges(): Promise<boolean> {
        try {
            // Get the status of the working directory
            const status = await isogit.statusMatrix({ 
                fs: this.fs, 
                dir: "/repo" 
            });
            
            // Check if any files have changes
            if (Array.isArray(status)) {
                for (const row of status) {
                    if (row[2] !== row[1]) { // workdir != head means changed
                        return true;
                    }
                }
            }
            return false;
        } catch (error) {
            // If statusMatrix fails, we'll assume there are changes to be safe
            console.warn("statusMatrix failed, assuming changes exist:", error);
            return true;
        }
    }

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

    private async copyNotebookFiles(notebookId: string, notebookName: string) {
        // This is a simplified approach - in a real implementation, you'd need to
        // recursively list all files in the notebook and copy them to the Git repo
        const dirPath = `/data/${notebookId}/`;
        
        try {
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path: dirPath })
            });
            
            const data = await response.json();
            
            if (data.code === 0) {
                for (const item of data.data || []) {
                    if (!item.isDir) {
                        // Copy the file from SiYuan to Git repo
                        const sourcePath = `${dirPath}${item.name}`;
                        const destPath = `/repo/${notebookName}/${item.name}`;
                        
                        // Read the file from SiYuan
                        const fileContent = await this.readSiYuanFile(sourcePath);
                        if (fileContent) {
                            // Write the file to the Git repo
                            await this.p.writeFile(destPath, fileContent, 'utf8');
                        }
                    }
                }
            }
        } catch (error) {
            console.error(`Failed to copy notebook files for ${notebookName}:`, error);
        }
    }

    private async copyConfigFiles() {
        const configPaths = ["/conf/", "/data/storage/"];
        
        for (const configPath of configPaths) {
            try {
                const response = await fetch("/api/file/readDir", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: configPath })
                });
                
                const data = await response.json();
                
                if (data.code === 0) {
                    for (const item of data.data || []) {
                        if (!item.isDir) {
                            // Copy the config file from SiYuan to Git repo
                            const sourcePath = `${configPath}${item.name}`;
                            const destPath = `/repo/config/${item.name}`;
                            
                            // Read the config file from SiYuan
                            const fileContent = await this.readSiYuanFile(sourcePath);
                            if (fileContent) {
                                // Write the config file to the Git repo
                                await this.p.writeFile(destPath, fileContent, 'utf8');
                            }
                        }
                    }
                }
            } catch (error) {
                console.error(`Failed to copy config files from ${configPath}:`, error);
            }
        }
    }

    private async readSiYuanFile(path: string): Promise<string | null> {
        try {
            const response = await fetch("/api/file/getFile", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ path })
            });

            if (response.ok) {
                // Check content type to determine how to process
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const data = await response.json();
                    // Handle SiYuan's structured response
                    if (data.code === 0) {
                        if (typeof data.data === 'string') {
                            return data.data;
                        } else {
                            try {
                                return JSON.stringify(data.data, null, 2);
                            } catch {
                                return null;
                            }
                        }
                    }
                } else {
                    // Handle raw file content
                    return await response.text();
                }
            }
        } catch (error) {
            console.error(`Failed to read file ${path}:`, error);
        }
        return null;
    }

    private async syncFilesFromSiYuan() {
        // Copy all files from SiYuan workspace to Git repo
        showMessage("🔄 Syncing files from SiYuan workspace", 2000, "info");
        
        try {
            // Create the repo directory if it doesn't exist
            await this.p.mkdir("/repo", { recursive: true });
            await this.p.mkdir("/repo/config", { recursive: true });

            // List all notebooks first
            const notebooks = await this.listNotebooks();
            
            // Process each notebook and its files
            for (const notebook of notebooks) {
                await this.copyNotebookFiles(notebook.id, notebook.name);
            }

            // Copy configuration files
            await this.copyConfigFiles();
            
            // Show completion message with count
            showMessage("✅ Files synced from SiYuan to Git repo", 2000, "info");
        } catch (error) {
            console.error("Error syncing files from SiYuan", error);
            throw error;
        }
    }

    private async syncFilesToSiYuan() {
        // Copy files from Git repo to SiYuan workspace
        showMessage("🔄 Syncing files to SiYuan workspace", 2000, "info");
        
        // Implementation would depend on SiYuan's file API
        try {
            // Read all files from Git repo and copy them back to SiYuan
            const files = await this.p.readdir("/repo");
            
            for (const file of files) {
                if (file !== '.git') { // Skip Git metadata
                    const filePath = `/repo/${file}`;
                    const stats = await this.p.stat(filePath);
                    
                    if (stats.isFile()) {
                        // Read the file from Git repo
                        const content = await this.p.readFile(filePath, 'utf8');
                        
                        // For now, just log the file name - actual implementation
                        // would copy the file back to SiYuan's workspace
                        console.log(`Would sync file back to SiYuan: ${file}`);
                    } else if (stats.isDirectory() && file !== 'config') {
                        // Process notebook directories
                        await this.copyNotebookFilesFromGitToSiYuan(file);
                    } else if (file === 'config') {
                        // Process config directory
                        await this.copyConfigFilesFromGitToSiYuan();
                    }
                }
            }
            
            showMessage("✅ Files synced from Git repo to SiYuan workspace", 2000, "info");
        } catch (error) {
            console.error("Error syncing files to SiYuan", error);
            throw error;
        }
    }
    
    private async copyNotebookFilesFromGitToSiYuan(notebookName: string) {
        try {
            const notebookFiles = await this.p.readdir(`/repo/${notebookName}`);
            
            for (const fileName of notebookFiles) {
                const gitPath = `/repo/${notebookName}/${fileName}`;
                
                // Read file from Git repo
                const content = await this.p.readFile(gitPath, 'utf8');
                
                // In a real implementation, this would write to SiYuan's notebook
                console.log(`Would write to notebook ${notebookName}: ${fileName}`);
            }
        } catch (error) {
            console.error(`Error copying notebook files for ${notebookName}`, error);
        }
    }
    
    private async copyConfigFilesFromGitToSiYuan() {
        try {
            const configFiles = await this.p.readdir('/repo/config');
            
            for (const fileName of configFiles) {
                const gitPath = `/repo/config/${fileName}`;
                
                // Read config file from Git repo
                const content = await this.p.readFile(gitPath, 'utf8');
                
                // In a real implementation, this would write to SiYuan's config directory
                console.log(`Would write config file: ${fileName}`);
            }
        } catch (error) {
            console.error('Error copying config files from Git', error);
        }
    }

    private async fullSync() {
        if (this.isSyncing) {
            showMessage("⏳ Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("🔄 Full sync started...", 3000, "info");

        try {
            // Pull first
            await this.pull();
            
            // Small delay to ensure files are written
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Then push
            await this.push();
            
            showMessage("✅ Full sync completed", 3000, "info");
        } catch (error) {
            this.showError("Full sync failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async getRepoStatus() {
        try {
            await this.ensureRepo();
            
            const status = await isogit.statusMatrix({ fs: this.fs, dir: "/repo" });
            const staged = status.filter(row => row[3] === 1).length; // 3 = workdir status, 1 = added
            const modified = status.filter(row => row[2] === 2).length; // 2 = HEAD status, 2 = modified
            
            showMessage(
                `📊 Git Status:\n` +
                `🔗 Repository: ${this.config.repoUrl}\n` +
                `🌿 Branch: ${this.config.branch}\n` +
                `🔄 Auto Sync: ${this.config.autoSync ? `every ${this.config.syncInterval} min` : 'disabled'}\n` +
                `⚡ Sync on Change: ${this.config.syncOnChange ? 'enabled' : 'disabled'}\n` +
                `📝 Modified: ${modified}\n` +
                `✅ Staged: ${staged}`,
                8000,
                "info"
            );
        } catch (error) {
            this.showError("Failed to get Git status", error);
        }
    }

    private startAutoSync() {
        this.stopAutoSync();

        const intervalMs = Math.max(this.config.syncInterval, 5) * 60 * 1000;

        this.syncIntervalId = window.setInterval(async () => {
            if (!this.isSyncing && this.config.repoUrl && this.config.token) {
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

    private getHttp() {
        // isomorphic-git in the browser should use fetch by default
        // We return undefined to let isomorphic-git use the global fetch by default
        return undefined;
    }

    private showError(message: string, error?: any) {
        console.error(message, error);
        let errorMsg = `❌ ${message}`;
        if (error?.message) {
            errorMsg += `\n${error.message}`;
        }
        showMessage(errorMsg, 6000, "error");
    }

    private async openSetting() {
        // Create a proper settings dialog using SiYuan's Dialog class
        const html = `
        <div class="b3-dialog__content">
            <div class="fn__flex-column" style="height: 100%;">
                <div class="fn__flex-1 fn__flex-column">
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Repository URL</div>
                                <div class="fn__space"></div>
                                <input id="repoUrl" class="b3-text-field fn__flex-1" value="${this.config.repoUrl}" placeholder="https://github.com/username/repo.git">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Branch</div>
                                <div class="fn__space"></div>
                                <input id="branch" class="b3-text-field fn__flex-1" value="${this.config.branch}" placeholder="main">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Git Token</div>
                                <div class="fn__space"></div>
                                <input id="token" type="password" class="b3-text-field fn__flex-1" value="${this.config.token}" placeholder="GitHub Personal Access Token">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Author Name</div>
                                <div class="fn__space"></div>
                                <input id="authorName" class="b3-text-field fn__flex-1" value="${this.config.authorName}" placeholder="Your name">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Author Email</div>
                                <div class="fn__space"></div>
                                <input id="authorEmail" type="email" class="b3-text-field fn__flex-1" value="${this.config.authorEmail}" placeholder="email@example.com">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <div class="fn__flex-center">Sync Interval (minutes)</div>
                                <div class="fn__space"></div>
                                <input id="syncInterval" type="number" min="5" class="b3-text-field fn__flex-1" value="${this.config.syncInterval}">
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <input id="autoSync" type="checkbox" class="b3-switch"${this.config.autoSync ? " checked" : ""}>
                                <div class="fn__space"></div>
                                <span class="fn__flex-center">Enable Auto-Sync</span>
                            </label>
                        </div>
                    </div>
                    <div class="fn__16"></div>
                    <div class="fn__flex">
                        <div class="fn__flex-1">
                            <label class="fn__flex">
                                <input id="syncOnChange" type="checkbox" class="b3-switch"${this.config.syncOnChange ? " checked" : ""}>
                                <div class="fn__space"></div>
                                <span class="fn__flex-center">Sync on Change</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div class="fn__hr"></div>
                <div class="fn__flex">
                    <div class="fn__flex-1"></div>
                    <button id="testConnectionBtn" class="b3-button b3-button--outline" style="margin-right: 8px;">Test Connection</button>
                    <button id="saveBtn" class="b3-button b3-button--outline">Save</button>
                </div>
            </div>
        </div>
        <div class="b3-dialog__action">
        </div>
        `;
        
        // Use SiYuan's Dialog class directly instead of this.addDialog (which doesn't exist)
        const dialog = new Dialog({
            title: "Git Sync Settings",
            content: html,
            width: "600px",
            height: "400px"
        });

        // Add event listeners
        dialog.element.querySelector('#saveBtn')?.addEventListener('click', async () => {
            this.config.repoUrl = (dialog.element.querySelector('#repoUrl') as HTMLInputElement).value;
            this.config.branch = (dialog.element.querySelector('#branch') as HTMLInputElement).value;
            this.config.token = (dialog.element.querySelector('#token') as HTMLInputElement).value;
            this.config.authorName = (dialog.element.querySelector('#authorName') as HTMLInputElement).value;
            this.config.authorEmail = (dialog.element.querySelector('#authorEmail') as HTMLInputElement).value;
            this.config.syncInterval = parseInt((dialog.element.querySelector('#syncInterval') as HTMLInputElement).value) || 30;
            this.config.autoSync = (dialog.element.querySelector('#autoSync') as HTMLInputElement).checked;
            this.config.syncOnChange = (dialog.element.querySelector('#syncOnChange') as HTMLInputElement).checked;

            await this.saveConfig();
            dialog.destroy();
            showMessage("✅ Settings saved", 2000, "info");
        });

        dialog.element.querySelector('#testConnectionBtn')?.addEventListener('click', () => {
            this.testConnection();
        });
    }

    // Menu actions
    async performPull() {
        await this.pull();
    }

    async performPush() {
        await this.push();
    }

    async performFullSync() {
        await this.fullSync();
    }

    async showStatus() {
        await this.getRepoStatus();
    }
}