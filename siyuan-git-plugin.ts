/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub using isomorphic-git
 */

import { Plugin, showMessage } from "siyuan";

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

    async onload() {
        console.log("Loading Git Sync Plugin");
        
        // Load config
        await this.loadConfig();

        // Add top bar icon
        this.addTopBarIcon();

        // Add settings tab
        this.openSetting();

        showMessage("Git Sync Plugin Loaded", 2000, "info");
    }

    onunload() {
        console.log("Unloading Git Sync Plugin");
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

    private async testConnection() {
        if (!this.config.repoUrl) {
            showMessage("Please configure repository URL first", 3000, "error");
            return;
        }

        showMessage("Testing connection... (This is a placeholder - real Git integration pending)", 5000, "info");
        
        // TODO: Implement actual Git connection test with isomorphic-git
        // For now, just validate the URL format
        try {
            new URL(this.config.repoUrl);
            showMessage("✅ URL format is valid. Full Git integration coming soon!", 3000, "info");
        } catch {
            showMessage("❌ Invalid repository URL format", 3000, "error");
        }
    }

    private async pushToGithub() {
        showMessage("🔄 Push to GitHub - Implementation pending", 3000, "info");
        // TODO: Implement with isomorphic-git
    }

    private async pullFromGithub() {
        showMessage("🔄 Pull from GitHub - Implementation pending", 3000, "info");
        // TODO: Implement with isomorphic-git
    }

    private async fullSync() {
        showMessage("🔄 Full Sync - Implementation pending", 3000, "info");
        // TODO: Implement with isomorphic-git
    }

    private async showStatus() {
        showMessage("📊 Status check - Implementation pending", 3000, "info");
        // TODO: Implement with isomorphic-git
    }
}