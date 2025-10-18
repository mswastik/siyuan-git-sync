/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub using isomorphic-git
 */

import {
    Plugin,
    showMessage,
    Dialog,
    Menu,
} from "siyuan";
import "@siyuan-community/siyuan-plugin-types";
import git from "isomorphic-git";
import http from "isomorphic-git/http/web";
import fs from "@isomorphic-git/lightning-fs";

const PLUGIN_NAME = "git-sync";
const CONFIG_FILE = "git-sync-config.json";

interface GitConfig {
    repoUrl: string;
    branch: string;
    username: string;
    token: string;
    author: {
        name: string;
        email: string;
    };
    autoSync: boolean;
    syncInterval: number; // minutes
}

export default class GitSyncPlugin extends Plugin {
    private config: GitConfig | null = null;
    private isMobile: boolean = false;
    private fs: any;
    private syncInterval: number | null = null;

    async onload() {
        this.isMobile = this.data[PLUGIN_NAME]?.isMobile || false;
        
        // Initialize Lightning FS (browser-compatible filesystem)
        this.fs = new fs(PLUGIN_NAME);

        // Load config
        await this.loadConfig();

        // Add toolbar button
        this.addTopBar();

        // Add settings
        this.addSettingTab();

        // Start auto-sync if enabled
        if (this.config?.autoSync) {
            this.startAutoSync();
        }

        console.log("Git Sync Plugin loaded");
    }

    onunload() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
        console.log("Git Sync Plugin unloaded");
    }

    private async loadConfig() {
        try {
            const configStr = await this.loadData(CONFIG_FILE);
            if (configStr) {
                this.config = JSON.parse(configStr);
            }
        } catch (e) {
            console.log("No config found, using defaults");
            this.config = {
                repoUrl: "",
                branch: "main",
                username: "",
                token: "",
                author: {
                    name: "SiYuan User",
                    email: "user@siyuan.local"
                },
                autoSync: false,
                syncInterval: 60
            };
        }
    }

    private async saveConfig() {
        await this.saveData(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    }

    private addTopBar() {
        const topBarElement = this.addTopBar({
            icon: "iconCloud",
            title: "Git Sync",
            position: "right",
            callback: () => {
                this.showSyncMenu();
            }
        });
    }

    private showSyncMenu() {
        const menu = new Menu();

        if (!this.config?.repoUrl) {
            menu.addItem({
                label: "⚙️ Configure Git Sync First",
                click: () => {
                    showMessage("Please configure Git sync in Settings", 3000, "info");
                }
            });
        } else {
            menu.addItem({
                label: "⬆️ Push to GitHub",
                click: async () => {
                    await this.syncToGithub();
                }
            });

            menu.addItem({
                label: "⬇️ Pull from GitHub",
                click: async () => {
                    await this.pullFromGithub();
                }
            });

            menu.addItem({
                label: "🔄 Full Sync (Pull + Push)",
                click: async () => {
                    await this.fullSync();
                }
            });

            menu.addSeparator();

            menu.addItem({
                label: "📊 View Status",
                click: async () => {
                    await this.showStatus();
                }
            });
        }

        menu.open({
            x: window.innerWidth - 200,
            y: 50
        });
    }

    private addSettingTab() {
        this.addTab({
            type: "setting",
            init: () => {
                this.createSettingPanel();
            }
        });
    }

    private createSettingPanel() {
        const container = document.createElement("div");
        container.className = "config-panel";
        container.innerHTML = `
            <h2>Git Sync Configuration</h2>
            <div class="config-item">
                <label>GitHub Repository URL:</label>
                <input type="text" id="repo-url" placeholder="https://github.com/username/repo.git" 
                       value="${this.config?.repoUrl || ''}" />
            </div>
            <div class="config-item">
                <label>Branch:</label>
                <input type="text" id="branch" value="${this.config?.branch || 'main'}" />
            </div>
            <div class="config-item">
                <label>GitHub Username:</label>
                <input type="text" id="username" value="${this.config?.username || ''}" />
            </div>
            <div class="config-item">
                <label>GitHub Personal Access Token:</label>
                <input type="password" id="token" placeholder="ghp_xxxxxxxxxxxx" 
                       value="${this.config?.token || ''}" />
                <small>Create token at: https://github.com/settings/tokens</small>
            </div>
            <div class="config-item">
                <label>Author Name:</label>
                <input type="text" id="author-name" value="${this.config?.author.name || 'SiYuan User'}" />
            </div>
            <div class="config-item">
                <label>Author Email:</label>
                <input type="email" id="author-email" value="${this.config?.author.email || 'user@siyuan.local'}" />
            </div>
            <div class="config-item">
                <label>
                    <input type="checkbox" id="auto-sync" ${this.config?.autoSync ? 'checked' : ''} />
                    Enable Auto-Sync
                </label>
            </div>
            <div class="config-item">
                <label>Sync Interval (minutes):</label>
                <input type="number" id="sync-interval" value="${this.config?.syncInterval || 60}" min="5" />
            </div>
            <button id="save-config" class="b3-button">Save Configuration</button>
            <button id="test-connection" class="b3-button">Test Connection</button>
        `;

        // Add event listeners
        container.querySelector("#save-config")?.addEventListener("click", async () => {
            await this.saveSettings(container);
        });

        container.querySelector("#test-connection")?.addEventListener("click", async () => {
            await this.testConnection();
        });

        return container;
    }

    private async saveSettings(container: HTMLElement) {
        this.config = {
            repoUrl: (container.querySelector("#repo-url") as HTMLInputElement).value,
            branch: (container.querySelector("#branch") as HTMLInputElement).value,
            username: (container.querySelector("#username") as HTMLInputElement).value,
            token: (container.querySelector("#token") as HTMLInputElement).value,
            author: {
                name: (container.querySelector("#author-name") as HTMLInputElement).value,
                email: (container.querySelector("#author-email") as HTMLInputElement).value,
            },
            autoSync: (container.querySelector("#auto-sync") as HTMLInputElement).checked,
            syncInterval: parseInt((container.querySelector("#sync-interval") as HTMLInputElement).value)
        };

        await this.saveConfig();
        showMessage("Configuration saved!", 2000, "info");

        if (this.config.autoSync) {
            this.startAutoSync();
        } else if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }
    }

    private async testConnection() {
        if (!this.config?.repoUrl) {
            showMessage("Please configure repository URL first", 3000, "error");
            return;
        }

        showMessage("Testing connection...", 2000, "info");

        try {
            // Try to fetch remote info
            const info = await git.getRemoteInfo({
                http,
                url: this.config.repoUrl,
                onAuth: () => ({
                    username: this.config!.username,
                    password: this.config!.token
                })
            });

            showMessage("✅ Connection successful!", 3000, "info");
        } catch (e) {
            showMessage(`❌ Connection failed: ${e.message}`, 5000, "error");
        }
    }

    private async syncToGithub() {
        if (!this.config?.repoUrl) {
            showMessage("Please configure Git sync first", 3000, "error");
            return;
        }

        showMessage("🔄 Syncing to GitHub...", 2000, "info");

        try {
            const dir = "/workspace";
            
            // Initialize repo if needed
            await this.initRepoIfNeeded(dir);

            // Get workspace files
            const files = await this.getWorkspaceFiles();

            // Add all files
            for (const file of files) {
                await git.add({ fs: this.fs, dir, filepath: file });
            }

            // Commit
            const timestamp = new Date().toISOString();
            await git.commit({
                fs: this.fs,
                dir,
                message: `SiYuan sync: ${timestamp}`,
                author: this.config.author
            });

            // Push
            await git.push({
                fs: this.fs,
                http,
                dir,
                remote: "origin",
                ref: this.config.branch,
                onAuth: () => ({
                    username: this.config!.username,
                    password: this.config!.token
                })
            });

            showMessage("✅ Successfully pushed to GitHub!", 3000, "info");
        } catch (e) {
            showMessage(`❌ Sync failed: ${e.message}`, 5000, "error");
            console.error(e);
        }
    }

    private async pullFromGithub() {
        if (!this.config?.repoUrl) {
            showMessage("Please configure Git sync first", 3000, "error");
            return;
        }

        showMessage("⬇️ Pulling from GitHub...", 2000, "info");

        try {
            const dir = "/workspace";

            await git.pull({
                fs: this.fs,
                http,
                dir,
                ref: this.config.branch,
                author: this.config.author,
                onAuth: () => ({
                    username: this.config!.username,
                    password: this.config!.token
                })
            });

            showMessage("✅ Successfully pulled from GitHub!", 3000, "info");
        } catch (e) {
            showMessage(`❌ Pull failed: ${e.message}`, 5000, "error");
            console.error(e);
        }
    }

    private async fullSync() {
        await this.pullFromGithub();
        await this.syncToGithub();
    }

    private async initRepoIfNeeded(dir: string) {
        try {
            await git.log({ fs: this.fs, dir, depth: 1 });
        } catch {
            // Repo doesn't exist, initialize
            await git.init({ fs: this.fs, dir });
            await git.addRemote({
                fs: this.fs,
                dir,
                remote: "origin",
                url: this.config!.repoUrl
            });
        }
    }

    private async getWorkspaceFiles(): Promise<string[]> {
        // This is a simplified version - you'll need to use SiYuan's API
        // to get actual workspace files
        const response = await fetch("/api/file/readDir", {
            method: "POST",
            body: JSON.stringify({ path: "/data/" })
        });
        
        const data = await response.json();
        return data.data?.map((f: any) => f.path) || [];
    }

    private async showStatus() {
        try {
            const dir = "/workspace";
            const status = await git.statusMatrix({ fs: this.fs, dir });
            
            const changes = status.filter(row => row[1] !== row[2] || row[2] !== row[3]);
            
            if (changes.length === 0) {
                showMessage("✅ No changes to sync", 3000, "info");
            } else {
                showMessage(`📊 ${changes.length} file(s) changed`, 3000, "info");
            }
        } catch (e) {
            showMessage(`Status check failed: ${e.message}`, 3000, "error");
        }
    }

    private startAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        const intervalMs = (this.config?.syncInterval || 60) * 60 * 1000;
        
        this.syncInterval = window.setInterval(async () => {
            console.log("Auto-sync triggered");
            await this.fullSync();
        }, intervalMs);

        showMessage(`Auto-sync enabled (every ${this.config?.syncInterval} minutes)`, 3000, "info");
    }
}
