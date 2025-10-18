# SiYuan Git Sync Plugin

A powerful plugin to sync your SiYuan workspace with GitHub using **isomorphic-git**. Works on both **Desktop** and **Android**!

## ✨ Features

- 🔄 Two-way sync with GitHub (pull & push)
- 📱 Works on Desktop (Windows/Mac/Linux) AND Android
- 🔐 Secure authentication with GitHub Personal Access Token
- ⏰ Auto-sync at configurable intervals
- 📊 View sync status
- 🎯 No Git CLI required - pure JavaScript implementation
- ☁️ Works offline - commit locally, sync when online

## 📋 Prerequisites

### 1. GitHub Personal Access Token

1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Give it a name: `SiYuan Sync`
4. Select scopes:
   - ✅ `repo` (all sub-options)
5. Click "Generate token"
6. **Save the token** (you'll need it in the plugin settings)

### 2. Create GitHub Repository

1. Go to: https://github.com/new
2. Repository name: `siyuan-backup` (or any name)
3. Choose: **Private** (recommended for personal notes)
4. **Don't** initialize with README
5. Click "Create repository"
6. Copy the repository URL: `https://github.com/yourusername/siyuan-backup.git`

## 🚀 Installation

### Method 1: From SiYuan Plugin Marketplace (Coming Soon)

1. Open SiYuan
2. Go to Settings → Plugin Marketplace
3. Search for "Git Sync"
4. Click Install

### Method 2: Manual Installation (Current)

#### Step 1: Clone/Download the Plugin

```bash
# Clone the repository
git clone https://github.com/yourusername/siyuan-plugin-git-sync.git

# Or download ZIP and extract it
```

#### Step 2: Build the Plugin

```bash
# Navigate to plugin directory
cd siyuan-plugin-git-sync

# Install dependencies
npm install

# Build the plugin
npm run build
```

This creates a `dist` folder with the compiled plugin.

#### Step 3: Install to SiYuan

**Desktop:**
1. Open SiYuan data directory:
   - Windows: `C:\Users\YourName\AppData\Roaming\SiYuan\data\plugins`
   - Mac: `~/Library/Application Support/SiYuan/data/plugins`
   - Linux: `~/.config/SiYuan/data/plugins`
2. Create folder: `plugins/git-sync`
3. Copy contents of `dist` folder into `plugins/git-sync`

**Android:**
1. Open SiYuan app
2. Go to: Settings → About → Open data directory
3. Navigate to: `plugins/` folder
4. Create folder: `git-sync`
5. Copy plugin files using a file manager app

#### Step 4: Restart SiYuan

Close and reopen SiYuan. You should see the cloud icon in the top bar.

## ⚙️ Configuration

1. Click the **cloud icon** in the top bar
2. Select **Settings** (or go to Settings → Plugins → Git Sync)
3. Fill in the configuration:

```
GitHub Repository URL: https://github.com/yourusername/siyuan-backup.git
Branch: main
GitHub Username: yourusername
GitHub Token: ghp_xxxxxxxxxxxxxxxxxxxx
Author Name: Your Name
Author Email: your.email@example.com

☐ Enable Auto-Sync
Sync Interval: 60 minutes
```

4. Click **Save Configuration**
5. Click **Test Connection** to verify it works

## 📖 Usage

### Manual Sync

Click the **cloud icon** in the top bar, then choose:

- **⬆️ Push to GitHub** - Upload local changes
- **⬇️ Pull from GitHub** - Download remote changes
- **🔄 Full Sync** - Pull then push (recommended)
- **📊 View Status** - Check for uncommitted changes

### Auto-Sync

Enable "Auto-Sync" in settings to automatically sync at regular intervals.

## 🔧 Troubleshooting

### "Connection failed: Authentication required"
- Double-check your GitHub token
- Make sure the token has `repo` scope
- Token might have expired - generate a new one

### "Push failed: Repository not found"
- Verify the repository URL is correct
- Make sure the repository exists on GitHub
- Check if it's private and you have access

### Android: "Plugin not loading"
- Make sure you copied ALL files from the `dist` folder
- Check SiYuan version is 3.0.0 or higher
- Try clearing SiYuan cache: Settings → About → Clear cache

### "Merge conflict detected"
- Manual resolution required
- Download your workspace
- Fix conflicts using desktop Git client
- Re-upload to SiYuan

## 🔒 Security Notes

- ✅ Your token is stored locally on your device
- ✅ Token is never sent anywhere except GitHub
- ✅ Use **private** repositories for personal notes
- ⚠️ Never commit your token to the repository itself
- ⚠️ Regenerate token if compromised

## 📁 What Gets Synced?

The plugin syncs your entire SiYuan workspace:
- ✅ All markdown notes
- ✅ Assets (images, files)
- ✅ Database files
- ✅ Configuration (optional)
- ❌ `.siyuan` folder (ignored by default)
- ❌ Temp files (ignored)

## 🛠️ Development

### File Structure

```
siyuan-plugin-git-sync/
├── src/
│   └── index.ts          # Main plugin code
├── package.json          # Dependencies
├── plugin.json           # Plugin manifest
├── vite.config.ts        # Build configuration
├── tsconfig.json         # TypeScript config
└── README.md             # This file
```

### Build Commands

```bash
# Development mode (auto-rebuild on changes)
npm run dev

# Production build
npm run build
```

### Testing

1. Make changes to `src/index.ts`
2. Run `npm run build`
3. Copy `dist` contents to SiYuan plugins folder
4. Restart SiYuan

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test on both desktop and Android
5. Submit a pull request

## 📝 License

MIT License - feel free to use and modify!

## 💖 Support

If this plugin helps you, consider:
- ⭐ Starring the repository
- 🐛 Reporting bugs
- 💡 Suggesting features
- ☕ Buying me a coffee

## 📚 Resources

- [SiYuan Documentation](https://docs.siyuan-note.club/)
- [isomorphic-git Documentation](https://isomorphic-git.org/)
- [GitHub API Documentation](https://docs.github.com/en/rest)

## ❓ FAQ

**Q: Will this work with GitLab/Gitea?**  
A: Yes! Just use the appropriate repository URL.

**Q: Can I use SSH instead of HTTPS?**  
A: Not currently - isomorphic-git in browsers only supports HTTPS.

**Q: Does this use Git LFS for large files?**  
A: Not yet, but it's planned for a future version.

**Q: Will it slow down SiYuan?**  
A: No, syncing happens in the background without blocking the UI.

**Q: Can I sync to multiple repositories?**  
A: Not in v1.0, but it's a planned feature.

---

**Made with ❤️ for the SiYuan community**
