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

    private async listFiles(notebookId: string, path: string = "/"): Promise<any[]> {
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
                    const subFiles = await this.listFiles(notebookId, itemPath);
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
                console.error(`Failed to read plugin directory ${dirName}:`, errorMessage);
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
                console.error(`Failed to read template directory ${dirName}:`, errorMessage);
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
        const notebooks = await this.listNotebooks();

        console.log(`Found ${notebooks.length} notebooks`);

        // Process notebooks and their .sy files
        for (const notebook of notebooks) {
            console.log(`Processing notebook: ${notebook.name} (${notebook.id})`);
            const files = await this.listFiles(notebook.id);
            console.log(`  Found ${files.length} .sy files`);

            for (const file of files) {
                const content = await this.readLocalFile(file.fullPath);
                if (content !== null) {
                    const relativePath = `${notebook.name}${file.path}`;
                    fileMap.set(relativePath, content);
                    console.log(`  Added: ${relativePath}`);
                } else {
                    console.error(`  Failed to read: ${file.fullPath}`);
                }
            }
        }

        // Process config files if enabled
        if (this.config.syncConfig) {
            const configFiles = await this.listConfigFiles();
            console.log(`Found ${configFiles.length} config files`);
            for (const file of configFiles) {
                const content = await this.readLocalFile(file.fullPath);
                if (content !== null) {
                    const relativePath = `config${file.path}`;
                    fileMap.set(relativePath, content);
                    console.log(`  Added config: ${relativePath}`);
                } else {
                    console.error(`  Failed to read config: ${file.fullPath}`);
                }
            }
        }

        // Process plugins if enabled
        if (this.config.syncPlugins) {
            const pluginFiles = await this.listPlugins();
            console.log(`Found ${pluginFiles.length} plugin files`);
            for (const file of pluginFiles) {
                const content = await this.readLocalFile(file.fullPath);
                if (content !== null) {
                    const relativePath = `plugins${file.path}`;
                    fileMap.set(relativePath, content);
                    console.log(`  Added plugin: ${relativePath}`);
                } else {
                    console.error(`  Failed to read plugin: ${file.fullPath}`);
                }
            }
        }

        // Process templates if enabled
        if (this.config.syncTemplates) {
            const templateFiles = await this.listTemplates();
            console.log(`Found ${templateFiles.length} template files`);
            for (const file of templateFiles) {
                const content = await this.readLocalFile(file.fullPath);
                if (content !== null) {
                    const relativePath = `templates${file.path}`;
                    fileMap.set(relativePath, content);
                    console.log(`  Added template: ${relativePath}`);
                } else {
                    console.error(`  Failed to read template: ${file.fullPath}`);
                }
            }
        }

        console.log(`Total files to sync: ${fileMap.size}`);
        return fileMap;
    }

    private async createOrUpdateFile(path: string, content: string, sha?: string): Promise<void> {
        const message = sha
        ? `Update ${path}`
        : `Create ${path}`;

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

            const message = `✅ Push complete\n` +
            `📤 Uploaded: ${uploaded}\n` +
            `🔄 Updated: ${updated}\n` +
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
            const githubTree = await this.getGitHubTree();
            const notebooks = await this.listNotebooks();
            const notebookMap = new Map(notebooks.map((nb: any) => [nb.name, nb]));

            let created = 0;
            let updated = 0;
            let skipped = 0;
            let errors = 0;

            for (const item of githubTree) {
                if (item.type !== "blob" || !item.path.endsWith('.sy')) {
                    continue;
                }

                try {
                    const parts = item.path.split('/');
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
                                errors++;
                                continue;
                            }
                        }
                    }

                    const localPath = `/data/${notebook.id}${relativePath}`;
                    const remoteFile = await this.getFileContent(item.path);

                    if (!remoteFile) {
                        errors++;
                        continue;
                    }

                    const localContent = await this.readLocalFile(localPath);

                    if (localContent !== null && localContent === remoteFile.content) {
                        skipped++;
                        continue;
                    }

                    const success = await this.writeLocalFile(localPath, remoteFile.content);
                    if (success) {
                        if (localContent === null) {
                            created++;
                        } else {
                            updated++;
                        }
                    } else {
                        console.error(`Failed to write local file ${localPath}`);
                        errors++;
                    }
                } catch (error) {
                    console.error(`Failed to sync ${item.path}:`, error);
                    errors++;
                }
            }

            const message = `✅ Pull complete\n` +
            `📥 Created: ${created}\n` +
            `🔄 Updated: ${updated}\n` +
            `⏭️ Skipped: ${skipped}` +
            (errors > 0 ? `\n❌ Errors: ${errors}` : '');

            showMessage(message, 5000, "info");

            // Reload workspace to show new files
            if (created > 0 || updated > 0) {
                await fetch("/api/filetree/refreshFiletree", { method: "POST" });
                // Also try to refresh the document tree view
                await fetch("/api/filetree/renameDoc", { 
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ notebook: "", path: "/" })
                }).catch(() => {}); // Ignore errors from this optional refresh
            }
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
        this.isSyncing = true;

        try {
            // Pull first to get remote changes
            await this.pullFromGitHubInternal();

            // Small delay to ensure files are written
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Then push local changes
            await this.pushToGitHubInternal();

            showMessage("✅ Full sync completed", 3000, "info");
        } catch (error) {
            this.showError("Full sync failed", error);
        } finally {
            this.isSyncing = false;
        }
    }

    // Internal methods that don't set isSyncing flag
    private async pullFromGitHubInternal() {
        const githubTree = await this.getGitHubTree();
        const notebooks = await this.listNotebooks();
        const notebookMap = new Map(notebooks.map((nb: any) => [nb.name, nb]));

        let totalProcessed = 0;

        for (const item of githubTree) {
            if (item.type !== "blob" || !item.path.endsWith('.sy')) continue;

            const parts = item.path.split('/');
            const notebookName = parts[0];
            const relativePath = '/' + parts.slice(1).join('/');

            let notebook = notebookMap.get(notebookName);
            if (!notebook) {
                const response = await fetch("/api/notebook/createNotebook", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: notebookName })
                });
                const data = await response.json();
                if (data.code === 0) {
                    notebook = data.data.notebook;
                    notebookMap.set(notebookName, notebook);
                }
            }

            if (notebook) {
                const localPath = `/data/${notebook.id}${relativePath}`;
                const remoteFile = await this.getFileContent(item.path);

                if (remoteFile) {
                    const localContent = await this.readLocalFile(localPath);
                    if (localContent !== remoteFile.content) {
                        await this.writeLocalFile(localPath, remoteFile.content);
                        totalProcessed++;
                    }
                }
            }
        }

        if (totalProcessed > 0) {
            await fetch("/api/filetree/refreshFiletree", { method: "POST" });
        }
    }

    private async pushToGitHubInternal() {
        const localFiles = await this.getLocalFiles();
        const githubTree = await this.getGitHubTree();

        const githubFiles = new Map<string, GitHubTreeItem>();
        for (const item of githubTree) {
            if (item.type === "blob") {
                githubFiles.set(item.path, item);
            }
        }

        let totalProcessed = 0;

        for (const [path, content] of localFiles) {
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
