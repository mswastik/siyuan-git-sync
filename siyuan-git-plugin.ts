/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub using isomorphic-git
 */

import { Plugin, showMessage } from "siyuan";
import * as git from "isomorphic-git";
import http from "isomorphic-git/http/web";

// For browser environments, we need to create a file system implementation
// Using browser's IndexedDB or localStorage as the backend
import { createFsFromVolume, vol } from "memfs";

const PLUGIN_NAME = "git-sync";

interface GitConfig {
    repoUrl: string;
    branch: string;
    username: string;
    token: string;
    authorName: string;
    authorEmail: string;
    autoSync: boolean;
    syncInterval: number;
}

export default class GitSyncPlugin extends Plugin {
    private config: GitConfig = {
        repoUrl: "",
        branch: "main",
        username: "",
        token: "",
        authorName: "SiYuan User",
        authorEmail: "user@siyuan.local",
        autoSync: false,
        syncInterval: 60
    };
    
    private topBarElement: HTMLElement;
    private settingPanel: HTMLElement;
    private syncIntervalId: number | null = null;
    private isSyncing = false;
    private fs: any; // File system implementation

    async onload() {
        console.log("Loading Git Sync Plugin");
        
        // Initialize file system
        this.fs = createFsFromVolume(vol);
        
        // Load config
        await this.loadConfig();

        // Add top bar icon
        this.addTopBarIcon();

        // Add settings tab
        this.openSetting();

        // Start auto-sync if enabled
        if (this.config.autoSync) {
            this.startAutoSync();
        }

        showMessage("Git Sync Plugin Loaded", 2000, "info");
    }

    onunload() {
        console.log("Unloading Git Sync Plugin");
        
        // Clear auto-sync interval if running
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
        }
    }

    private async loadConfig() {
        const savedConfig = await this.loadData("config.json");
        if (savedConfig) {
            try {
                this.config = { ...this.config, ...JSON.parse(savedConfig) };
            } catch (e) {
                console.error("Failed to parse config:", e);
            }
        }
    }

    private async saveConfig() {
        await this.saveData("config.json", JSON.stringify(this.config, null, 2));
        
        // Restart auto-sync if settings have changed
        if (this.config.autoSync) {
            this.startAutoSync();
        } else {
            this.stopAutoSync();
        }
        
        showMessage("Configuration saved", 2000, "info");
    }

    private addTopBarIcon() {
        const iconElement = this.addTopBar({
            icon: "iconCloud",
            title: "Git Sync",
            position: "right",
            callback: () => {
                this.showSyncDialog();
            }
        });
        this.topBarElement = iconElement;
    }

    private showProgress(message: string, progress?: number) {
        let displayMessage = message;
        if (progress !== undefined) {
            displayMessage += ` (${Math.round(progress)}%)`;
        }
        // Use a longer timeout for progress messages since they're intermediate
        showMessage(displayMessage, 3000, "info");
    }

    private showSyncDialog() {
        const dialog = document.createElement("div");
        dialog.className = "b3-dialog";
        dialog.innerHTML = `
            <div class="b3-dialog__scrim"></div>
            <div class="b3-dialog__container" style="width: 400px;">
                <div class="b3-dialog__header">
                    <div class="b3-dialog__title">Git Sync</div>
                    <button class="b3-dialog__close"><svg><use xlink:href="#iconClose"></use></svg></button>
                </div>
                <div class="b3-dialog__content">
                    ${this.config.repoUrl ? `
                        <div class="fn__flex-column" style="gap: 10px;">
                            <button class="b3-button b3-button--outline" data-action="push">
                                ⬆️ Push to GitHub
                            </button>
                            <button class="b3-button b3-button--outline" data-action="pull">
                                ⬇️ Pull from GitHub
                            </button>
                            <button class="b3-button b3-button--outline" data-action="sync">
                                🔄 Full Sync (Pull + Push)
                            </button>
                            <button class="b3-button b3-button--outline" data-action="status">
                                📊 View Status
                            </button>
                        </div>
                    ` : `
                        <div class="b3-label__text">
                            Please configure Git Sync in Settings first.
                        </div>
                        <button class="b3-button b3-button--outline" data-action="settings">
                            ⚙️ Open Settings
                        </button>
                    `}
                </div>
                <div class="b3-dialog__footer">
                    <div class="fn__flex">
                        <span class="fn__flex-1" id="git-status-text">Status: Ready</span>
                        <div class="git-sync-status-indicator" style="width: 12px; height: 12px; border-radius: 50%; background-color: #505050;"></div>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(dialog);

        // Add event listeners
        dialog.querySelector(".b3-dialog__close")?.addEventListener("click", () => {
            dialog.remove();
        });

        dialog.querySelector(".b3-dialog__scrim")?.addEventListener("click", () => {
            dialog.remove();
        });

        dialog.querySelectorAll("button[data-action]").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                const action = (e.target as HTMLElement).closest("button")?.dataset.action;
                dialog.remove();
                
                switch (action) {
                    case "push":
                        await this.pushToGithub();
                        break;
                    case "pull":
                        await this.pullFromGithub();
                        break;
                    case "sync":
                        await this.fullSync();
                        break;
                    case "status":
                        await this.showStatus();
                        break;
                    case "settings":
                        // Open settings - handled by SiYuan
                        break;
                }
            });
        });
    }

    private async testConnection() {
        if (!this.config.repoUrl) {
            showMessage("Please configure repository URL first", 3000, "error");
            return;
        }

        showMessage("Testing connection...", 5000, "info");
        
        try {
            // Initialize the repo if needed
            await this.initializeGitRepo();
            
            // Try to fetch from the remote to test the connection
            await git.fetch({
                fs: this.fs,
                http,
                dir: "/",
                remote: "origin",
                depth: 1, // Shallow fetch for faster testing
                onAuth: () => ({
                    username: this.config.token,
                    password: "" // For token-based auth
                })
            });
            
            showMessage("✅ Connection test successful!", 3000, "info");
        } catch (error) {
            this.handleError("test connection", error);
        }
    }

    private async initializeGitRepo() {
        try {
            // In a browser environment, we use an in-memory filesystem
            const dir = "/"; // Using root in the virtual filesystem

            // Check if the repo is already initialized by looking for .git directory
            try {
                await this.fs.promises.stat("/.git");
                // If this succeeds, the repo is already initialized
                return true;
            } catch (e) {
                // .git directory doesn't exist, need to initialize
                showMessage("Initializing Git repository...", 2000, "info");
                
                // Initialize the git repository
                await git.init({
                    fs: this.fs,
                    dir,
                    defaultBranch: this.config.branch
                });

                // Add the remote origin
                if (this.config.repoUrl) {
                    await git.addRemote({
                        fs: this.fs,
                        dir,
                        remote: "origin",
                        url: this.config.repoUrl
                    });
                }
                
                showMessage("Git repository initialized", 3000, "info");
            }
            
            return true;
        } catch (error) {
            this.handleError("initialize Git repo", error);
            return false;
        }
    }

    private handleError(operation: string, error: any) {
        let errorMessage = `Operation failed: ${operation}`;
        
        if (error instanceof Error) {
            errorMessage += `\nError: ${error.message}`;
            
            // Check for specific error types and provide more helpful messages
            if (error.message.includes("authentication")) {
                errorMessage += "\nHint: Check your GitHub token and permissions";
            } else if (error.message.includes("404") || error.message.includes("not found")) {
                errorMessage += "\nHint: Check your repository URL";
            } else if (error.message.includes("network")) {
                errorMessage += "\nHint: Check your internet connection";
            } else if (error.message.includes("refusing to merge")) {
                errorMessage += "\nHint: There may be conflicting changes that require manual resolution";
            }
        } else {
            errorMessage += `\nError: ${JSON.stringify(error)}`;
        }
        
        console.error(`Git operation failed (${operation}):`, error);
        showMessage(errorMessage, 8000, "error");
    }

    private async pullFromGithub() {
        if (this.isSyncing) {
            showMessage("Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("Pulling from GitHub...", 5000, "info");

        try {
            const dir = "/";
            
            // Fetch changes from remote
            await git.fetch({
                fs: this.fs,
                http,
                dir,
                remote: "origin",
                depth: 1, // Shallow fetch for better performance
                onAuth: () => ({
                    username: this.config.token,
                    password: "" // For token-based auth
                }),
                onProgress: (progress) => {
                    console.log("Fetch progress:", progress);
                }
            });

            // Merge changes from remote branch
            await git.merge({
                fs: this.fs,
                dir,
                ours: this.config.branch,
                theirs: `origin/${this.config.branch}`
            });

            // Checkout to apply the merge
            await git.checkout({
                fs: this.fs,
                dir,
                ref: this.config.branch
            });

            showMessage("Successfully pulled from GitHub", 3000, "info");
        } catch (error) {
            this.handleError("pull from GitHub", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async pushToGithub() {
        if (this.isSyncing) {
            showMessage("Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("Pushing to GitHub...", 5000, "info");

        try {
            const dir = "/";
            
            // Add all changes to the staging area
            await git.add({
                fs: this.fs,
                dir,
                filepath: "."
            });

            // Check if there are any changes to commit
            const status = await git.statusMatrix({
                fs: this.fs,
                dir,
                filepaths: [""]
            });

            // If there are changes to commit
            if (status && status.length > 0) {
                // Create a commit with changes
                await git.commit({
                    fs: this.fs,
                    dir,
                    message: `Sync from SiYuan - ${new Date().toISOString()}`,
                    author: {
                        name: this.config.authorName,
                        email: this.config.authorEmail,
                        date: new Date()
                    }
                });
            }

            // Push changes to the remote repository
            await git.push({
                fs: this.fs,
                http,
                dir,
                remote: "origin",
                ref: this.config.branch,
                onAuth: () => ({
                    username: this.config.token,
                    password: "" // For token-based auth
                }),
                onProgress: (progress) => {
                    console.log("Push progress:", progress);
                }
            });

            showMessage("Successfully pushed to GitHub", 3000, "info");
        } catch (error) {
            this.handleError("push to GitHub", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async showStatus() {
        if (this.isSyncing) {
            showMessage("Sync operation in progress, cannot check status", 2000, "info");
            return;
        }

        showMessage("Checking Git status...", 3000, "info");

        try {
            const dir = "/";
            
            // Get the status of all files in the repository
            const status = await git.statusMatrix({
                fs: this.fs,
                dir
            });

            // Parse the status results
            const stagedFiles = [];
            const unstagedFiles = [];
            const untrackedFiles = [];
            
            if (status) {
                for (const [filepath, , worktreeStatus, indexStatus] of status) {
                    // worktreeStatus: 0=unmodified, 1=modified, 2=deleted, 3=undelivered
                    // indexStatus: 0=unmodified, 1=modified, 2=deleted, 3=undelivered
                    
                    if (worktreeStatus === 0 && indexStatus === 0) {
                        // Unmodified
                    } else if (worktreeStatus === 1 && indexStatus === 0) {
                        // Modified in working directory but not staged
                        unstagedFiles.push(filepath);
                    } else if (worktreeStatus === 0 && indexStatus === 1) {
                        // Staged (added) but not committed
                        stagedFiles.push(filepath);
                    } else if (worktreeStatus === 2 && indexStatus === 0) {
                        // Deleted in working directory
                        unstagedFiles.push(filepath);
                    } else if (worktreeStatus === 2 && indexStatus === 2) {
                        // Deleted from both working directory and index
                    } else if (worktreeStatus === 0 && indexStatus === 0) {
                        // Unmodified
                    } else if (worktreeStatus === 3 || indexStatus === 3) {
                        // Undelivered files (newly created)
                        untrackedFiles.push(filepath);
                    } else if (worktreeStatus === 1 && indexStatus === 1) {
                        // Both modified in working directory and staged
                        stagedFiles.push(filepath);
                    }
                }
            }

            // Show status information to the user
            let statusMessage = "Git Status:\n";
            
            if (stagedFiles.length > 0) {
                statusMessage += `Staged files: ${stagedFiles.length}\n`;
            }
            
            if (unstagedFiles.length > 0) {
                statusMessage += `Unstaged files: ${unstagedFiles.length}\n`;
            }
            
            if (untrackedFiles.length > 0) {
                statusMessage += `Untracked files: ${untrackedFiles.length}\n`;
            }
            
            if (stagedFiles.length === 0 && unstagedFiles.length === 0 && untrackedFiles.length === 0) {
                statusMessage += "Working directory is clean\n";
            }
            
            showMessage(statusMessage, 8000, "info");
        } catch (error) {
            this.handleError("check Git status", error);
        }
    }

    private startAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
        }

        // Convert minutes to milliseconds
        const intervalMs = this.config.syncInterval * 60 * 1000;

        this.syncIntervalId = window.setInterval(async () => {
            if (!this.isSyncing) {
                console.log("Auto-sync triggered");
                await this.fullSync();
            }
        }, intervalMs);

        console.log(`Auto-sync started with interval: ${this.config.syncInterval} minutes`);
    }

    private stopAutoSync() {
        if (this.syncIntervalId) {
            clearInterval(this.syncIntervalId);
            this.syncIntervalId = null;
            console.log("Auto-sync stopped");
        }
    }

    private async fullSync() {
        if (this.isSyncing) {
            showMessage("Sync already in progress", 2000, "info");
            return;
        }

        this.isSyncing = true;
        showMessage("Starting full sync (pull + push)...", 5000, "info");

        try {
            // First pull to get any remote changes
            await this.pullFromGithub();
            
            // Then push any local changes
            await this.pushToGithub();
            
            showMessage("Full sync completed successfully", 3000, "info");
        } catch (error) {
            this.handleError("perform full sync", error);
        } finally {
            this.isSyncing = false;
        }
    }


    openSetting() {
        this.settingPanel = document.createElement("div");
        this.settingPanel.className = "fn__flex-column";
        
        const settingHTML = `
            <div class="config__tab-container">
                <h2>Git Sync Configuration</h2>
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">GitHub Repository URL</div>
                    <input class="b3-text-field fn__block" id="repo-url" 
                           placeholder="https://github.com/username/repo.git" 
                           value="${this.config.repoUrl}">
                    <div class="b3-label__text ft__smaller ft__secondary">
                        Example: https://github.com/yourusername/siyuan-backup.git
                    </div>
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">Branch</div>
                    <input class="b3-text-field fn__block" id="branch" 
                           value="${this.config.branch}">
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">GitHub Username</div>
                    <input class="b3-text-field fn__block" id="username" 
                           value="${this.config.username}">
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">GitHub Personal Access Token</div>
                    <input class="b3-text-field fn__block" id="token" type="password"
                           placeholder="ghp_xxxxxxxxxxxx" 
                           value="${this.config.token}">
                    <div class="b3-label__text ft__smaller ft__secondary">
                        Create at: <a href="https://github.com/settings/tokens" target="_blank">https://github.com/settings/tokens</a>
                    </div>
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">Author Name</div>
                    <input class="b3-text-field fn__block" id="author-name" 
                           value="${this.config.authorName}">
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">Author Email</div>
                    <input class="b3-text-field fn__block" id="author-email" 
                           value="${this.config.authorEmail}">
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <label class="fn__flex">
                        <input type="checkbox" id="auto-sync" class="b3-switch" 
                               ${this.config.autoSync ? "checked" : ""}>
                        <span class="b3-label__text">Enable Auto-Sync</span>
                    </label>
                </div>
                
                <div class="b3-label" style="margin-top: 16px;">
                    <div class="b3-label__text">Sync Interval (minutes)</div>
                    <input class="b3-text-field fn__block" id="sync-interval" type="number" min="5"
                           value="${this.config.syncInterval}">
                </div>
                
                <div class="fn__flex" style="margin-top: 24px; gap: 8px;">
                    <button class="b3-button b3-button--outline" id="save-config">
                        💾 Save Configuration
                    </button>
                    <button class="b3-button b3-button--outline" id="test-connection">
                        🔌 Test Connection
                    </button>
                </div>
            </div>
        `;
        
        this.settingPanel.innerHTML = settingHTML;
        
        // Add event listeners
        this.settingPanel.querySelector("#save-config")?.addEventListener("click", () => {
            this.saveSettings();
        });
        
        this.settingPanel.querySelector("#test-connection")?.addEventListener("click", () => {
            this.testConnection();
        });

        this.addTab({
            type: "setting",
            init: () => {
                this.settingPanel.style.padding = "16px";
            },
            destroy: () => {
                console.log("Settings tab destroyed");
            }
        });
    }

    private saveSettings() {
        const getValue = (id: string): string => {
            return (this.settingPanel.querySelector(`#${id}`) as HTMLInputElement)?.value || "";
        };
        
        const getChecked = (id: string): boolean => {
            return (this.settingPanel.querySelector(`#${id}`) as HTMLInputElement)?.checked || false;
        };

        this.config = {
            repoUrl: getValue("repo-url"),
            branch: getValue("branch"),
            username: getValue("username"),
            token: getValue("token"),
            authorName: getValue("author-name"),
            authorEmail: getValue("author-email"),
            autoSync: getChecked("auto-sync"),
            syncInterval: parseInt(getValue("sync-interval")) || 60
        };

        this.saveConfig();
    }
}