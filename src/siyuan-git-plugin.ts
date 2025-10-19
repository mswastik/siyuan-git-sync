/**
 * SiYuan Git Sync Plugin
 * Syncs your workspace with GitHub - preserves file structure and syncs .sy files directly
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
    syncConfig: boolean;
    syncPlugins: boolean;
    syncTemplates: boolean;
}

interface GitHubTreeItem {
    path: string;
    mode: string;
    type: string;
    sha?: string;
    size?: number;
    url?: string;
}

interface LocalFile {
    path: string;
    content: string;
    isNew: boolean;
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
        syncInterval: 30,
        syncConfig: true,
        syncPlugins: false,
        syncTemplates: false
    };

    private topBarElement: HTMLElement;
    private syncIntervalId: number | null = null;
    private isSyncing = false;
    private settingUtils: SettingUtils;

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
                const parsed = typeof savedConfig === 'string'
                ? JSON.parse(savedConfig)
                : savedConfig;
                this.config = { ...this.config, ...parsed };
                console.log("Config loaded successfully");
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

    private async githubRequest(endpoint: string, method: string = "GET", body?: any): Promise<any> {
        const url = `https://api.github.com${endpoint}`;
        const headers: Record<string, string> = {
            "Authorization": `Bearer ${this.config.token}`,
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json",
            "User-Agent": "SiYuan-Git-Sync-Plugin"
        };

        const options: RequestInit = { method, headers };
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
                try {
                    const ref = await this.githubRequest(
                        `/repos/${this.config.repoOwner}/${this.config.repoName}/git/refs/heads/${this.config.branch}`
                    );
                    const commit = await this.githubRequest(ref.object.url.replace('https://api.github.com', ''));
                    treeSha = commit.tree.sha;
                } catch (error: any) {
                    // Branch might not exist or have no commits yet
                    if (error.message.includes("404")) {
                        console.log("Branch not found or empty, returning empty tree");
                        return [];
                    }
                    throw error;
                }
            }

            // Check if it's the empty tree SHA
            if (treeSha === '4b825dc642cb6eb9a060e54bf8d69288fbee4904') {
                console.log("Empty tree detected, returning empty array");
                return [];
            }

            const tree = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}/git/trees/${treeSha}?recursive=1`
            );

            return tree.tree || [];
        } catch (error: any) {
            if (error.message.includes("404") || error.message.includes("Not Found")) {
                console.log("Tree not found, returning empty array");
                return [];
            }
            throw error;
        }
    }

    private async getFileContent(path: string): Promise<{ content: string; sha: string } | null> {
        try {
            const data = await this.githubRequest(
                `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}?ref=${this.config.branch}`
            );

            if (data.type === "file" && data.content) {
                return {
                    content: atob(data.content.replace(/\n/g, '')),
                    sha: data.sha
                };
            }
        } catch (error: any) {
            if (error.message.includes("404")) {
                return null;
            }
            throw error;
        }
        return null;
    }

    private async readLocalFile(path: string): Promise<string | null> {
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

            // Check if the response is JSON or raw content
            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                // Handle the structured response from SiYuan API
                const data = await response.json();
                console.log(`Read file response for ${path}:`, data);

                // SiYuan API may return the content directly without the standard wrapper for certain file types
                // If the response has ID, Spec, Type fields directly at the top level, it's the content (like .sy files)
                if ('ID' in data && 'Spec' in data && 'Type' in data) {
                    // This is the actual file content (structured document), convert to JSON string
                    try {
                        return JSON.stringify(data, null, 2);
                    } catch (stringifyError) {
                        console.error(`Error stringifying direct content for ${path}:`, stringifyError);
                        return null;
                    }
                }
                
                // Check if it's a config file with a spec/id/name structure (like av/*.json files)
                if (('spec' in data && 'id' in data) || ('keyValues' in data) || ('name' in data && 'keyValues' in data)) {
                    // This is a config file, convert to JSON string
                    try {
                        return JSON.stringify(data, null, 2);
                    } catch (stringifyError) {
                        console.error(`Error stringifying config file for ${path}:`, stringifyError);
                        return null;
                    }
                }
                
                // Otherwise, check for the standard API response format
                if (data.code === 0) {
                    // The real content is in the response, might be structured data
                    if (data.data !== undefined && data.data !== null) {
                        try {
                            // If data.data exists and has SiYuan document structure (ID, Spec, Type fields)
                            if (typeof data.data === 'object') {
                                if ('ID' in data.data && 'Spec' in data.data && 'Type' in data.data) {
                                    // This is a structured document object, convert to JSON string
                                    return JSON.stringify(data.data, null, 2);
                                } else {
                                    // This could be another type of object, convert to JSON string
                                    return JSON.stringify(data.data, null, 2);
                                }
                            }
                            // If it's already a string, return as-is
                            else if (typeof data.data === 'string') {
                                return data.data;
                            } else {
                                // Convert other types to string
                                return String(data.data);
                            }
                        } catch (stringifyError) {
                            console.error(`Error stringifying data for ${path}:`, stringifyError);
                            return null;
                        }
                    } else {
                        // If data.data is null/undefined but code is 0, return empty string
                        return "";
                    }
                } else {
                    // Handle case where msg might not exist
                    const errorMessage = data.msg || data.message || 'Unknown error';
                    console.error(`API error reading ${path}: ${errorMessage}`);
                    return null;
                }
            } else {
                // For non-JSON responses (probably raw file content), read as text
                const content = await response.text();
                console.log(`Raw content read for ${path}: length ${content.length}`);
                return content;
            }
        } catch (error) {
            console.error(`Failed to read local file ${path}:`, error);
            return null;
        }
    }

    private async writeLocalFile(path: string, content: string): Promise<boolean> {
        try {
            // Ensure content is a string
            if (typeof content !== 'string') {
                content = String(content);
            }
            
            // Create a Blob from the content
            const contentBlob = new Blob([content], { type: 'text/plain' });
            
            // Create FormData as SiYuan API might expect multipart form data
            const formData = new FormData();
            formData.append('path', path);
            formData.append('file', contentBlob, path.split('/').pop()); // Use the filename from the path
            formData.append('isDir', 'false');
            
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

    private async listNotebookFiles(notebookId: string, path: string = "/"): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read directory ${dirPath}:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;

                if (item.isDir) {
                    const subFiles = await this.listNotebookFiles(notebookId, itemPath);
                    allFiles = allFiles.concat(subFiles);
                } else if (item.name.endsWith('.sy')) {
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

    private async listConfigFiles(): Promise<any[]> {
        try {
            console.log(`Listing config files in: /data/storage/`);
            
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: '/data/storage/'
                })
            });

            if (!response.ok) {
                console.error(`HTTP error listing config directory: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            console.log(`readDir response for config:`, data);

            if (data.code !== 0) {
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read config directory:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${item.name}`;
                
                if (item.isDir) {
                    // Also check subdirectories in storage for configuration files
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

    private async listConfigSubDir(dirName: string): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read config subdirectory ${dirPath}:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${dirName}/${item.name}`;
                
                if (item.isDir) {
                    // Recursively process subdirectories
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

    private isConfigFile(filename: string): boolean {
        // Include common SiYuan config file types
        const configExtensions = ['.json', '.yaml', '.yml', '.conf', '.ini', '.txt'];
        return configExtensions.some(ext => filename.endsWith(ext)) || 
               filename === 'appearance' || 
               filename.includes('config') || 
               filename.includes('layout') || 
               filename.includes('query');
    }

    private async listPlugins(): Promise<any[]> {
        try {
            console.log(`Listing plugins in: /data/plugins/`);
            
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: '/data/plugins/'
                })
            });

            if (!response.ok) {
                console.error(`HTTP error listing plugins directory: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            console.log(`readDir response for plugins:`, data);

            if (data.code !== 0) {
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read plugins directory:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${item.name}`;
                
                if (item.isDir) {
                    // Recursively list all files in plugin directories
                    const pluginFiles = await this.listPluginFiles(item.name);
                    allFiles = allFiles.concat(pluginFiles);
                } else {
                    // Add plugin configuration files directly in plugins directory
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

    private async listPluginFiles(pluginName: string): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read plugin directory ${pluginName}:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${pluginName}/${item.name}`;
                
                if (item.isDir) {
                    // Recursively process subdirectories within the plugin
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

    private async listTemplates(): Promise<any[]> {
        try {
            console.log(`Listing templates in: /data/templates/`);
            
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: '/data/templates/'
                })
            });

            if (!response.ok) {
                console.error(`HTTP error listing templates directory: ${response.status} ${response.statusText}`);
                return [];
            }

            const data = await response.json();
            console.log(`readDir response for templates:`, data);

            if (data.code !== 0) {
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read templates directory:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${item.name}`;
                
                if (item.isDir) {
                    // Recursively list all files in template directories
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

    private async listTemplateFiles(templateDirName: string): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read template directory ${templateDirName}:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = `/${templateDirName}/${item.name}`;
                
                if (item.isDir) {
                    // Recursively process subdirectories within the template
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

    private isTemplateFile(filename: string): boolean {
        // Include common template file types
        return filename.endsWith('.md') || 
               filename.endsWith('.tpl') || 
               filename.endsWith('.template') ||
               filename.endsWith('.sy') || 
               filename.endsWith('.json');
    }

    private async getLocalFiles(): Promise<Map<string, string>> {
        const fileMap = new Map<string, string>();

        // Process workspace configuration files
        await this.addWorkspaceConfigFiles(fileMap);

        // Process data directory (notebooks, assets, storage, etc.)
        await this.addDataFiles(fileMap);

        console.log(`Total files to sync: ${fileMap.size}`);
        return fileMap;
    }

    private async addWorkspaceConfigFiles(fileMap: Map<string, string>): Promise<void> {
        // List files in workspace conf directory
        try {
            console.log(`Listing workspace config files in: /conf/`);
            
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: '/conf/'
                })
            });

            if (!response.ok) {
                console.error(`HTTP error listing workspace conf directory: ${response.status} ${response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log(`readDir response for workspace conf:`, data);

            if (data.code !== 0) {
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read workspace conf directory:`, errorMessage);
                return;
            }

            for (const item of data.data || []) {
                if (item.isDir) {
                    // Recursively process subdirectories in conf
                    await this.addConfSubDir(item.name, '/conf/', 'conf/', fileMap);
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

    private async addConfSubDir(dirName: string, basePath: string, relativePathPrefix: string, fileMap: Map<string, string>): Promise<void> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read conf subdirectory ${dirPath}:`, errorMessage);
                return;
            }

            for (const item of data.data || []) {
                const itemRelativePath = `${relativePathPrefix}${dirName}/${item.name}`;
                
                if (item.isDir) {
                    // Recursively process subdirectories
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

    private async addDataFiles(fileMap: Map<string, string>): Promise<void> {
        // List files in data directory (notebooks, assets, storage, etc.)
        try {
            console.log(`Listing data directory files in: /data/`);
            
            const response = await fetch("/api/file/readDir", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    path: '/data/'
                })
            });

            if (!response.ok) {
                console.error(`HTTP error listing data directory: ${response.status} ${response.statusText}`);
                return;
            }

            const data = await response.json();
            console.log(`readDir response for data:`, data);

            if (data.code !== 0) {
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read data directory:`, errorMessage);
                return;
            }

            // Define special directories that are not notebooks
            const specialDirs = ['storage', 'plugins', 'templates', 'assets', 'emojis', 'snippets', 'widgets', 'public'];
            
            // Process special directories first
            for (const item of data.data || []) {
                if (item.isDir && specialDirs.includes(item.name)) {
                    // Handle special directories based on their type and config settings
                    switch (item.name) {
                        case 'storage':
                            if (this.config.syncConfig) {
                                await this.addDataSubDir('storage', '/data/', fileMap);
                            }
                            break;
                        case 'plugins':
                            if (this.config.syncPlugins) {
                                await this.addDataSubDir('plugins', '/data/', fileMap);
                            }
                            break;
                        case 'templates':
                            if (this.config.syncTemplates) {
                                await this.addDataSubDir('templates', '/data/', fileMap);
                            }
                            break;
                        case 'assets':
                        case 'emojis':
                        case 'snippets':
                        case 'widgets':
                        case 'public':
                            // Process other special directories
                            await this.addDataSubDir(item.name, '/data/', fileMap);
                            break;
                        default:
                            // This shouldn't happen, but just in case
                            console.log(`Unknown special directory: ${item.name}`);
                            await this.addDataSubDir(item.name, '/data/', fileMap);
                    }
                }
            }
            
            // Process actual notebook directories (anything that's not a special directory)
            for (const item of data.data || []) {
                if (item.isDir && !specialDirs.includes(item.name)) {
                    // Process notebook directories
                    await this.addNotebookFiles(item.name, fileMap);
                }
            }
        } catch (error) {
            console.error(`Failed to list data files:`, error);
        }
    }

    private async addNotebookFiles(notebookName: string, fileMap: Map<string, string>): Promise<void> {
        try {
            // First, try to find the notebook by name to get its ID
            const notebooks = await this.listNotebooks();
            const notebook = notebooks.find((nb: any) => nb.name === notebookName || nb.id === notebookName);
            
            if (!notebook) {
                console.error(`Notebook not found: ${notebookName}`);
                return;
            }
            
            const notebookId = notebook.id;
            console.log(`Processing notebook: ${notebookName} (${notebookId})`);
            const files = await this.listFiles('/data', notebookId);
            console.log(`  Found ${files.length} files in notebook ${notebookName}`);

            for (const file of files) {
                const content = await this.readLocalFile(file.fullPath);
                if (content !== null) {
                    // Ensure the path starts with data/ and uses the actual notebook name
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
    private async listFiles(basePath: string, notebookId: string, path: string = "/"): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read directory ${dirPath}:`, errorMessage);
                return [];
            }

            let allFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;

                if (item.isDir) {
                    // Check if it's a .siyuan directory to handle notebook configs
                    if (item.name === '.siyuan') {
                        // Process notebook config directory
                        const configFiles = await this.listNotebookConfigFiles(notebookId, itemPath);
                        allFiles = allFiles.concat(configFiles);
                    } else {
                        // Recursively process other subdirectories
                        const subFiles = await this.listFiles(basePath, notebookId, itemPath);
                        allFiles = allFiles.concat(subFiles);
                    }
                } else {
                    // Add all file types, not just .sy files
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

    private async listNotebookConfigFiles(notebookId: string, path: string = "/"): Promise<any[]> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read notebook config directory ${dirPath}:`, errorMessage);
                return [];
            }

            let configFiles: any[] = [];

            for (const item of data.data || []) {
                const itemPath = path === "/" ? `/${item.name}` : `${path}/${item.name}`;

                if (item.isDir) {
                    // Recursively process subdirectories in .siyuan
                    const subFiles = await this.listNotebookConfigFiles(notebookId, itemPath);
                    configFiles = configFiles.concat(subFiles);
                } else {
                    // Add config file
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

    private async addDataSubDir(dirName: string, basePath: string, fileMap: Map<string, string>): Promise<void> {
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
                const errorMessage = data.msg || data.message || 'Unknown error';
                console.error(`Failed to read data subdirectory ${dirName}:`, errorMessage);
                return;
            }

            for (const item of data.data || []) {
                // Build the relative path correctly
                const itemRelativePath = `${dirName}/${item.name}`;
                
                if (item.isDir) {
                    // Recursively process subdirectories within the data subdirectories
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

    private async createOrUpdateFile(path: string, content: string, sha?: string): Promise<void> {
        // If we don't have the SHA but we think this is an update, we need to get the SHA first
        let fileSha = sha;
        if (!fileSha) {
            try {
                // Try to get the existing file to get its SHA
                const existingFile = await this.getFileContent(path);
                fileSha = existingFile?.sha;
            } catch (error) {
                // If we can't get the existing file, it probably doesn't exist, so we'll create it
                console.log(`File ${path} doesn't exist yet, will create it`);
            }
        }

        const message = fileSha
        ? `Update ${path}`
        : `Create ${path}`;

        // Always encode content as base64 for GitHub API
        let encodedContent: string;
        try {
            // For text content, we need to properly encode it
            encodedContent = btoa(unescape(encodeURIComponent(content)));
        } catch (encodeError) {
            // For binary content or content that can't be encoded as UTF-8, encode as binary
            try {
                // Convert string to binary data
                const binaryData = new TextEncoder().encode(content);
                // Convert binary data to base64
                encodedContent = btoa(String.fromCharCode(...binaryData));
            } catch (binaryError) {
                // Last resort: try to encode as-is
                encodedContent = btoa(content);
            }
        }

        const body: any = {
            message: `${message} - ${new Date().toLocaleString()}`,
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

        // Only include sha in the body if we have it (for updates)
        if (fileSha) {
            body.sha = fileSha;
        }

        await this.githubRequest(
            `/repos/${this.config.repoOwner}/${this.config.repoName}/contents/${encodeURIComponent(path)}`,
                                 "PUT",
                                 body
        );
    }

    private async deleteFileFromGitHub(path: string, sha?: string): Promise<void> {
        // If we don't have the SHA, try to get it first
        let fileSha = sha;
        if (!fileSha) {
            try {
                const existingFile = await this.getFileContent(path);
                fileSha = existingFile?.sha;
            } catch (error) {
                // If file doesn't exist on GitHub, nothing to delete
                console.log(`File ${path} doesn't exist on GitHub, no need to delete`);
                return;
            }
        }

        if (!fileSha) {
            console.log(`Cannot delete ${path} - no SHA provided and could not retrieve it`);
            return;
        }

        const body: any = {
            message: `Delete ${path} - ${new Date().toLocaleString()}`,
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

    private async deleteLocalFile(path: string): Promise<boolean> {
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
    private isBase64(str: string): boolean {
        try {
            return btoa(atob(str)) === str;
        } catch (err) {
            return false;
        }
    }

    // Helper function to properly encode content as base64
    private base64Encode(content: string): string {
        try {
            // Try regular base64 encoding for text content
            return btoa(unescape(encodeURIComponent(content)));
        } catch (error) {
            // If that fails, handle as binary
            try {
                // Convert string to binary data
                const binaryData = new TextEncoder().encode(content);
                // Convert binary data to base64
                return btoa(String.fromCharCode(...binaryData));
            } catch (err) {
                // Last resort: try to encode as-is
                return btoa(content);
            }
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
            const localFiles = await this.getLocalFiles();
            const githubTree = await this.getGitHubTree();

            const githubFiles = new Map<string, GitHubTreeItem>();
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

            // Process files: create, update, or delete
            for (const [path, content] of localFiles) {
                try {
                    const githubFile = githubFiles.get(path);

                    if (githubFile) {
                        const remoteFile = await this.getFileContent(path);
                        if (remoteFile && remoteFile.content === content) {
                            skipped++;
                            continue;
                        }
                        await this.createOrUpdateFile(path, content, remoteFile?.sha);
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

            // Delete files that exist on GitHub but no longer exist locally
            for (const [path, githubFile] of githubFiles) {
                if (!localFiles.has(path)) {
                    // Check if this is a file type we're managing (e.g., .sy files, config files)
                    if (path.endsWith('.sy') || 
                        path.startsWith('config/') || 
                        path.startsWith('plugins/') || 
                        path.startsWith('templates/')) {
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

            const message = `✅ Push complete\n` +
            `📤 Uploaded: ${uploaded}\n` +
            `🔄 Updated: ${updated}\n` +
            `🗑️ Deleted: ${deleted}\n` +
            `⏭️ Skipped: ${skipped}` +
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
            const result = await this.performPullOperation();
            
            const message = `✅ Pull complete\n` +
            `📥 Created: ${result.created}\n` +
            `🔄 Updated: ${result.updated}\n` +
            `🗑️ Deleted: ${result.deleted}\n` +
            `⏭️ Skipped: ${result.skipped}` +
            (result.errors > 0 ? `\n❌ Errors: ${result.errors}` : '');

            showMessage(message, 5000, "info");
        } catch (error) {
            this.showError("Pull failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async performPullOperation(): Promise<{created: number, updated: number, skipped: number, deleted: number, errors: number}> {
        const githubTree = await this.getGitHubTree();
        const localFiles = await this.getLocalFiles(); // Get current local files to compare against
        
        const notebooks = await this.listNotebooks();
        const notebookMap = new Map(notebooks.map((nb: any) => [nb.name, nb]));

        let created = 0;
        let updated = 0;
        let skipped = 0;
        let deleted = 0;
        let errors = 0;

        // Process files to download from GitHub
        for (const item of githubTree) {
            // Skip if not a blob
            if (item.type !== "blob") {
                continue;
            }

            try {
                // Parse the path to determine the type of file
                const parts = item.path.split('/');
                
                // Handle different file types based on path
                const pathResult = await this.handlePullFileByType(item, parts, notebooks, notebookMap);
                
                if (pathResult) {
                    if (pathResult.status === 'created') created++;
                    else if (pathResult.status === 'updated') updated++;
                    else if (pathResult.status === 'skipped') skipped++;
                    else if (pathResult.status === 'error') errors++;
                } else {
                    // If pathResult is null, there was an error
                    errors++;
                }
            } catch (error) {
                console.error(`Failed to sync ${item.path}:`, error);
                errors++;
            }
        }

        // Delete local files that no longer exist on GitHub
        for (const [path, content] of localFiles) {
            // Check if this local file exists in the GitHub tree
            const existsOnGitHub = githubTree.some(item => 
                item.type === "blob" && 
                item.path === path &&
                (path.endsWith('.sy') || path.startsWith('config/') || path.startsWith('plugins/') || path.startsWith('templates/'))
            );
            
            if (!existsOnGitHub) {
                // File exists locally but not on GitHub, consider deleting it
                try {
                    // Extract notebook name and path from local file structure
                    const pathParts = path.split('/');
                    if (path.startsWith('notebooks/')) {
                        // It's a notebook file: notebooks/{notebookName}/{filePath}
                        if (pathParts.length >= 3) {
                            const notebookName = pathParts[1];
                            const notebook = notebookMap.get(notebookName);
                            if (notebook) {
                                const relativePath = '/' + pathParts.slice(2).join('/');
                                const localPath = `/data/${notebook.id}${relativePath}`;
                                if (await this.deleteLocalFile(localPath)) {
                                    deleted++;
                                } else {
                                    console.error(`Failed to delete local file ${localPath}`);
                                    errors++;
                                }
                            }
                        }
                    } else if (path.startsWith('config/')) {
                        // It's a config file: config/{filePath}
                        const relativePath = '/' + pathParts.slice(1).join('/');
                        const localPath = `/data/storage${relativePath}`;
                        if (await this.deleteLocalFile(localPath)) {
                            deleted++;
                        } else {
                            console.error(`Failed to delete local config file ${localPath}`);
                            errors++;
                        }
                    } else if (path.startsWith('plugins/')) {
                        // It's a plugin file: plugins/{filePath}
                        const relativePath = '/' + pathParts.slice(1).join('/');
                        const localPath = `/data/plugins${relativePath}`;
                        if (await this.deleteLocalFile(localPath)) {
                            deleted++;
                        } else {
                            console.error(`Failed to delete local plugin file ${localPath}`);
                            errors++;
                        }
                    } else if (path.startsWith('templates/')) {
                        // It's a template file: templates/{filePath}
                        const relativePath = '/' + pathParts.slice(1).join('/');
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

        // Reload workspace to show new files if any changes were made
        if (created > 0 || updated > 0 || deleted > 0) {
            await fetch("/api/filetree/refreshFiletree", { method: "POST" });
            // Also try to refresh the document tree view
            await fetch("/api/filetree/renameDoc", { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notebook: "", path: "/" })
            }).catch(() => {}); // Ignore errors from this optional refresh
        }

        return { created, updated, skipped, deleted, errors };
    }
    
    private async handlePullFileByType(item: GitHubTreeItem, parts: string[], notebooks: any[], notebookMap: Map<string, any>): Promise<{status: string} | null> {
        if (parts[0] === "notebooks") {
            // It's a notebook file: notebooks/{notebookName}/{filePath}
            const notebookName = parts[1];
            const relativePath = '/' + parts.slice(2).join('/');
            
            let notebook = notebookMap.get(notebookName);
            if (!notebook) {
                const matchingNotebook = notebooks.find((nb: any) => nb.name === notebookName || nb.id === notebookName);
                if (matchingNotebook) {
                    notebook = matchingNotebook;
                    notebookMap.set(notebookName, notebook);
                } else {
                    // Create a new notebook if it doesn't exist
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
                return {status: 'skipped'};
            }

            const success = await this.writeLocalFile(localPath, remoteFile.content);
            if (success) {
                return {status: localContent === null ? 'created' : 'updated'};
            } else {
                console.error(`Failed to write local file ${localPath}`);
                return {status: 'error'};
            }
        }
        // Check if this is a config file (starts with "config/")
        else if (parts[0] === "config") {
            // It's a config file: config/{filePath}
            const relativePath = '/' + parts.slice(1).join('/');
            const localPath = `/data/storage${relativePath}`;
            
            const remoteFile = await this.getFileContent(item.path);

            if (!remoteFile) {
                return null;
            }

            const localContent = await this.readLocalFile(localPath);

            if (localContent !== null && localContent === remoteFile.content) {
                return {status: 'skipped'};
            }

            const success = await this.writeLocalFile(localPath, remoteFile.content);
            if (success) {
                return {status: localContent === null ? 'created' : 'updated'};
            } else {
                console.error(`Failed to write local config file ${localPath}`);
                return {status: 'error'};
            }
        }
        // Check if this is a plugin file (starts with "plugins/")
        else if (parts[0] === "plugins") {
            // It's a plugin file: plugins/{filePath}
            const relativePath = '/' + parts.slice(1).join('/');
            const localPath = `/data/plugins${relativePath}`;
            
            const remoteFile = await this.getFileContent(item.path);

            if (!remoteFile) {
                return null;
            }

            const localContent = await this.readLocalFile(localPath);

            if (localContent !== null && localContent === remoteFile.content) {
                return {status: 'skipped'};
            }

            const success = await this.writeLocalFile(localPath, remoteFile.content);
            if (success) {
                return {status: localContent === null ? 'created' : 'updated'};
            } else {
                console.error(`Failed to write local plugin file ${localPath}`);
                return {status: 'error'};
            }
        }
        // Check if this is a template file (starts with "templates/")
        else if (parts[0] === "templates") {
            // It's a template file: templates/{filePath}
            const relativePath = '/' + parts.slice(1).join('/');
            const localPath = `/data/templates${relativePath}`;
            
            const remoteFile = await this.getFileContent(item.path);

            if (!remoteFile) {
                return null;
            }

            const localContent = await this.readLocalFile(localPath);

            if (localContent !== null && localContent === remoteFile.content) {
                return {status: 'skipped'};
            }

            const success = await this.writeLocalFile(localPath, remoteFile.content);
            if (success) {
                return {status: localContent === null ? 'created' : 'updated'};
            } else {
                console.error(`Failed to write local template file ${localPath}`);
                return {status: 'error'};
            }
        }
        // Otherwise, it's a legacy notebook file in the root
        else {
            // Legacy format: {notebookName}/{filePath}
            const notebookName = parts[0];
            const relativePath = '/' + parts.slice(1).join('/');
            
            let notebook = notebookMap.get(notebookName);
            if (!notebook) {
                // Try to find if there's a notebook with matching ID in the name
                const matchingNotebook = notebooks.find((nb: any) => nb.name === notebookName || nb.id === notebookName);
                if (matchingNotebook) {
                    notebook = matchingNotebook;
                    notebookMap.set(notebookName, notebook);
                } else {
                    // Create a new notebook if it doesn't exist
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
                return {status: 'skipped'};
            }

            const success = await this.writeLocalFile(localPath, remoteFile.content);
            if (success) {
                return {status: localContent === null ? 'created' : 'updated'};
            } else {
                console.error(`Failed to write local file ${localPath}`);
                return {status: 'error'};
            }
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
        this.isSyncing = true;

        try {
            // Pull first to get remote changes
            const pullResult = await this.performPullOperation();

            // Small delay to ensure files are written
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Then push local changes
            const pushResult = await this.performPushOperation();

            const message = `✅ Full sync completed\n` +
            `📥 Pulled: ${pullResult.created + pullResult.updated}\n` +
            `📤 Pushed: ${pushResult.totalProcessed}\n` +
            `🗑️ Deleted: ${pullResult.deleted}` +
            (pullResult.errors > 0 || pushResult.errors > 0 ? `\n❌ Errors: ${pullResult.errors + pushResult.errors}` : '');

            showMessage(message, 5000, "info");
        } catch (error) {
            this.showError("Full sync failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    private async performPushOperation(): Promise<{totalProcessed: number, errors: number}> {
        const localFiles = await this.getLocalFiles();
        const githubTree = await this.getGitHubTree();

        const githubFiles = new Map<string, GitHubTreeItem>();
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
                        await this.createOrUpdateFile(path, content, remoteFile?.sha);
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

    private async showStatus() {
        if (!this.isConfigValid()) {
            showMessage("⚠️ Please configure settings first", 3000, "error");
            return;
        }

        showMessage("📊 Checking status...", 2000, "info");

        try {
            const localFiles = await this.getLocalFiles();
            const githubTree = await this.getGitHubTree();
            const githubSyFiles = githubTree.filter(item =>
            item.type === "blob" && item.path.endsWith('.sy')
            );

            const notebooks = await this.listNotebooks();

            const statusMsg = `📊 Status:\n\n` +
            `📚 Local notebooks: ${notebooks.length}\n` +
            `📄 Local files: ${localFiles.size}\n` +
            `☁️ GitHub files: ${githubSyFiles.length}\n` +
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
            key: "syncConfig",
            value: this.config.syncConfig,
            type: "checkbox",
            title: "Sync Config Files",
            description: "Sync configuration files (default: true)",
            action: {
                callback: () => {
                    const value = this.settingUtils.take("syncConfig");
                    if (value !== undefined) {
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
                    if (value !== undefined) {
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
                    if (value !== undefined) {
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
