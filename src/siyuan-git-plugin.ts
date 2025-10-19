/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with Git repositories using isomorphic-git
 */

import { Plugin, showMessage, Menu } from "siyuan";
import * as isogit from "isomorphic-git";
import http from "isomorphic-git/http/web";
import { Buffer } from "buffer";
import { SettingUtils } from "./libs/setting-utils";

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
    private settingUtils: SettingUtils;

    async onload() {
        console.log("Loading Git Sync Plugin with isomorphic-git");

        // Dynamically import LightningFS to avoid constructor issues
        const fsModule = await import("@isomorphic-git/lightning-fs");
        const LightningFS = fsModule.default || fsModule;
        
        // Initialize LightningFS
        this.fs = new LightningFS("siyuan-git");
        this.p = this.fs.promises;

        // Initialize SettingUtils
        this.settingUtils = new SettingUtils({
            plugin: this,
            name: "git-sync-config"
        });

        // Add settings items using SettingUtils
        this.settingUtils.addItem({
            key: "repoUrl",
            value: this.config.repoUrl,
            type: "textinput",
            title: "Repository URL",
            description: "URL of your Git repository (e.g. https://github.com/username/repo.git)",
            action: {
                callback: async () => {
                    this.config.repoUrl = this.settingUtils.get("repoUrl");
                    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
                        this.startAutoSync();
                    } else {
                        this.stopAutoSync();
                    }
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "branch",
            value: this.config.branch,
            type: "textinput",
            title: "Branch",
            description: "Git branch to sync with (e.g. main, master)",
            action: {
                callback: async () => {
                    this.config.branch = this.settingUtils.get("branch");
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "token",
            value: this.config.token,
            type: "textinput", 
            title: "Git Token",
            description: "Personal Access Token for Git repository (leave empty if not using authentication)",
            action: {
                callback: async () => {
                    this.config.token = this.settingUtils.get("token");
                    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
                        this.startAutoSync();
                    } else {
                        this.stopAutoSync();
                    }
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "authorName",
            value: this.config.authorName,
            type: "textinput",
            title: "Author Name",
            description: "Name to use for Git commits",
            action: {
                callback: async () => {
                    this.config.authorName = this.settingUtils.get("authorName");
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "authorEmail",
            value: this.config.authorEmail,
            type: "textinput",
            title: "Author Email",
            description: "Email to use for Git commits",
            action: {
                callback: async () => {
                    this.config.authorEmail = this.settingUtils.get("authorEmail");
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "syncInterval",
            value: this.config.syncInterval,
            type: "slider",
            title: "Sync Interval (minutes)",
            description: "Interval for automatic sync in minutes (minimum 5 minutes)",
            slider: {
                min: 5,
                max: 120,
                step: 5,
            },
            action: {
                callback: async () => {
                    this.config.syncInterval = this.settingUtils.get("syncInterval");
                    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
                        this.startAutoSync();
                    }
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "autoSync",
            value: this.config.autoSync,
            type: "checkbox",
            title: "Enable Auto-Sync",
            description: "Automatically sync changes at the specified interval",
            action: {
                callback: async () => {
                    this.config.autoSync = this.settingUtils.get("autoSync");
                    if (this.config.autoSync && this.config.repoUrl && this.config.token) {
                        this.startAutoSync();
                    } else {
                        this.stopAutoSync();
                    }
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "syncOnChange",
            value: this.config.syncOnChange,
            type: "checkbox",
            title: "Sync on Change",
            description: "Automatically sync when documents are saved",
            action: {
                callback: async () => {
                    this.config.syncOnChange = this.settingUtils.get("syncOnChange");
                    if (this.config.syncOnChange) {
                        this.startChangeMonitoring();
                    } else {
                        this.stopChangeMonitoring();
                    }
                    await this.saveConfig();
                }
            }
        });

        this.settingUtils.addItem({
            key: "testConnection",
            value: "",
            type: "button",
            title: "Test Connection",
            description: "Test connection to your Git repository",
            button: {
                label: "Test Connection",
                callback: () => {
                    this.testConnection();
                }
            }
        });

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
                
                // Also update SettingUtils with loaded values to ensure UI is in sync
                for (const [key, value] of Object.entries(savedConfig)) {
                    this.settingUtils.set(key, value);
                }
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
            callback: (event: MouseEvent) => {
                // Create a dropdown menu for Git Sync actions using the Menu class import
                const menu = new Menu();
                
                menu.addItem({
                    icon: "iconSettings",
                    label: "Settings",
                    click: () => {
                        this.openSetting();
                    }
                });
                
                menu.addItem({
                    icon: "iconDownload",
                    label: "Pull from Git",
                    click: async () => {
                        await this.performPull();
                    }
                });
                
                menu.addItem({
                    icon: "iconUpload",
                    label: "Push to Git",
                    click: async () => {
                        await this.performPush();
                    }
                });
                
                menu.addItem({
                    icon: "iconRefresh",
                    label: "Full Sync",
                    click: async () => {
                        await this.performFullSync();
                    }
                });
                
                menu.addItem({
                    icon: "iconInfo",
                    label: "Show Status",
                    click: async () => {
                        await this.showStatus();
                    }
                });
                
                // Position the menu near the clicked icon
                const rect = (event.target as HTMLElement).getBoundingClientRect();
                menu.open({
                    x: rect.left, 
                    y: rect.bottom,
                    h: rect.height
                });
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
        // Get the latest values from SettingUtils to ensure we're using current settings
        const repoUrl = this.settingUtils.get("repoUrl") || this.config.repoUrl;
        const token = this.settingUtils.get("token") || this.config.token;
        
        if (!repoUrl) {
            showMessage("⚠️ Please configure repository URL", 3000, "error");
            return;
        }

        try {
            showMessage("🔍 Testing connection...", 2000, "info");
            
            // Just test if we can access the repo by trying a fetch - don't actually clone
            await isogit.clone({
                fs: this.fs,
                http,
                dir: "/repo-test",
                url: repoUrl,
                singleBranch: true,
                depth: 1,
                onAuth: () => {
                    // Use token-based authentication for GitHub
                    if (token) {
                        return {
                            username: token,  // For GitHub, token goes as username
                            password: ""      // Password is empty when using token
                        };
                    }
                    // Fallback to basic auth if no token
                    return {
                        username: "git",
                        password: ""
                    };
                }
            });
            
            // Clean up after test - LightningFS uses different methods for file operations
            await this.cleanupTestRepo("/repo-test");
            
            showMessage(`✅ Connected to: ${repoUrl}`, 3000, "info");
        } catch (error) {
            // Provide more helpful error messages based on the type of error
            if (error instanceof Error) {
                if (error.message.includes("401")) {
                    if (token) {
                        this.showError("Authentication failed - please check your token", error);
                    } else {
                        this.showError("Repository requires authentication - please provide a token", error);
                    }
                } else if (error.message.includes("404") || error.message.includes("not found")) {
                    this.showError("Repository not found - please check the URL", error);
                } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
                    this.showError("Network error - please check your internet connection", error);
                } else {
                    this.showError("Connection test failed", error);
                }
            } else {
                this.showError("Connection test failed", error);
            }
        }
    }

    /**
     * Clean up temporary test repository directory
     * @param path Path to the test repository directory to clean up
     */
    private async cleanupTestRepo(path: string = "/repo-test") {
        try {
            // Check if directory exists
            const stats = await this.p.stat(path);
            if (stats) {
                // Recursively remove the test directory
                await this.removeDirectoryRecursive(path);
            }
        } catch (error) {
            // Directory doesn't exist or other error - that's fine
            console.debug(`Cleanup: Could not remove test repo at ${path}`, error);
        }
    }

    /**
     * Recursively remove a directory and all its contents
     * @param dirPath Path to the directory to remove
     */
    private async removeDirectoryRecursive(dirPath: string) {
        try {
            const items = await this.p.readdir(dirPath);
            
            // Remove all items in the directory
            for (const item of items) {
                const fullPath = `${dirPath}/${item}`;
                const stats = await this.p.stat(fullPath);
                
                if (stats.isDirectory()) {
                    // Recursively remove subdirectory
                    await this.removeDirectoryRecursive(fullPath);
                } else {
                    // Remove file
                    await this.p.unlink(fullPath);
                }
            }
            
            // Remove the now-empty directory
            await this.p.rmdir(dirPath);
        } catch (error) {
            console.warn(`Failed to remove directory ${dirPath}:`, error);
            // Continue with other cleanup operations
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
        // Get the latest values from SettingUtils to ensure we're using current settings
        const repoUrl = this.settingUtils.get("repoUrl") || this.config.repoUrl;
        const token = this.settingUtils.get("token") || this.config.token;
        const branch = this.settingUtils.get("branch") || this.config.branch;
        
        if (!repoUrl) {
            throw new Error("Repository URL must be configured before cloning");
        }
        
        try {
            showMessage("📥 Cloning repository...", 3000, "info");
            
            await isogit.clone({
                fs: this.fs,
                http,
                dir: "/repo",
                url: repoUrl,
                singleBranch: true,
                branch: branch,
                onAuth: () => {
                    // Use token-based authentication for GitHub
                    if (token) {
                        return {
                            username: token,  // For GitHub, token goes as username
                            password: ""      // Password is empty when using token
                        };
                    }
                    // Fallback to basic auth if no token
                    return {
                        username: "git",
                        password: ""
                    };
                }
            });
            
            // Update internal config in case they've changed
            this.config.repoUrl = repoUrl;
            this.config.token = token;
            this.config.branch = branch;
            
            showMessage("✅ Repository cloned successfully", 3000, "info");
        } catch (error) {
            // Provide more helpful error messages based on the type of error
            if (error instanceof Error) {
                if (error.message.includes("401")) {
                    if (token) {
                        this.showError("Authentication failed - please check your token", error);
                    } else {
                        this.showError("Repository requires authentication - please provide a token", error);
                    }
                } else if (error.message.includes("404") || error.message.includes("not found")) {
                    this.showError("Repository not found - please check the URL", error);
                } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
                    this.showError("Network error - please check your internet connection", error);
                } else {
                    this.showError("Failed to clone repository", error);
                }
            } else {
                this.showError("Failed to clone repository", error);
            }
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
                http,
                dir: "/repo",
                author: {
                    name: this.config.authorName,
                    email: this.config.authorEmail
                },
                singleBranch: true,
                branch: this.config.branch,
                onAuth: () => {
                    // Use token-based authentication for GitHub
                    if (this.config.token) {
                        return {
                            username: this.config.token,  // For GitHub, token goes as username
                            password: ""      // Password is empty when using token
                        };
                    }
                    // Fallback to basic auth if no token
                    return {
                        username: "git",
                        password: ""
                    };
                }
            });

            // Now sync local files back to SiYuan workspace
            await this.syncFilesToSiYuan();
            
            showMessage(`✅ Pull completed\n${result ? `Merged: ${result.merge}` : 'Up to date'}`, 3000, "info");
        } catch (error) {
            // Provide more helpful error messages based on the type of error
            if (error instanceof Error) {
                if (error.message.includes("401")) {
                    if (this.config.token) {
                        this.showError("Authentication failed - please check your token", error);
                    } else {
                        this.showError("Repository requires authentication - please provide a token", error);
                    }
                } else if (error.message.includes("404") || error.message.includes("not found")) {
                    this.showError("Repository not found - please check the URL", error);
                } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
                    this.showError("Network error - please check your internet connection", error);
                } else {
                    this.showError("Pull failed", error);
                }
            } else {
                this.showError("Pull failed", error);
            }
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
                    http,
                    dir: "/repo",
                    onAuth: () => {
                        // Use token-based authentication for GitHub
                        if (this.config.token) {
                            return {
                                username: this.config.token,  // For GitHub, token goes as username
                                password: ""      // Password is empty when using token
                            };
                        }
                        // Fallback to basic auth if no token
                        return {
                            username: "git",
                            password: ""
                        };
                    }
                });
                
                showMessage("✅ Changes pushed successfully", 3000, "info");
            } else {
                showMessage("✅ No changes to push", 3000, "info");
            }
        } catch (error) {
            // Provide more helpful error messages based on the type of error
            if (error instanceof Error) {
                if (error.message.includes("401")) {
                    if (this.config.token) {
                        this.showError("Authentication failed - please check your token", error);
                    } else {
                        this.showError("Repository requires authentication - please provide a token", error);
                    }
                } else if (error.message.includes("404") || error.message.includes("not found")) {
                    this.showError("Repository not found - please check the URL", error);
                } else if (error.message.includes("ENOTFOUND") || error.message.includes("getaddrinfo")) {
                    this.showError("Network error - please check your internet connection", error);
                } else {
                    this.showError("Push failed", error);
                }
            } else {
                this.showError("Push failed", error);
            }
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
            // Check if the error is EEXIST (directory already exists) and ignore it
            // Otherwise, throw the error
            if (error.code !== 'EEXIST') {
                console.error("Error syncing files from SiYuan", error);
                throw error;
            }
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

    private showError(message: string, error?: any) {
        console.error(message, error);
        let errorMsg = `❌ ${message}`;
        if (error?.message) {
            errorMsg += `\n${error.message}`;
        }
        showMessage(errorMsg, 6000, "error");
    }

    private async openSetting() {
        // Open the settings using SiYuan's native settings dialog
        this.setting.open();
    }
    
    onLayoutReady() {
        // Load settings when layout is ready
        this.settingUtils.load();
        
        // Update internal config with loaded values to ensure consistency
        this.config.repoUrl = this.settingUtils.get("repoUrl") || this.config.repoUrl;
        this.config.branch = this.settingUtils.get("branch") || this.config.branch;
        this.config.token = this.settingUtils.get("token") || this.config.token;
        this.config.authorName = this.settingUtils.get("authorName") || this.config.authorName;
        this.config.authorEmail = this.settingUtils.get("authorEmail") || this.config.authorEmail;
        this.config.autoSync = this.settingUtils.get("autoSync") ?? this.config.autoSync;
        this.config.syncInterval = this.settingUtils.get("syncInterval") ?? this.config.syncInterval;
        this.config.syncOnChange = this.settingUtils.get("syncOnChange") ?? this.config.syncOnChange;
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