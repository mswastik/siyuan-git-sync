# SiYuan Git Sync Plugin

A powerful plugin to sync your SiYuan notes with GitHub. Features full two-way synchronization with both push and pull support, plus enhanced folder structure and file deletion sync.

## ✨ Features

- 📤 **Push to GitHub** - Upload all your notebooks to GitHub as Markdown files
- 📥 **Pull from GitHub** - Download and import notes from GitHub into SiYuan
- 🔄 **Full Sync** - Two-way sync (pull then push) for seamless multi-device workflow
- ⏰ **Auto-Sync** - Automatically sync at regular intervals
- 🔍 **Test Connection** - Verify your GitHub settings before syncing
- 📊 **Status View** - Check local and remote file counts
- 🗑️ **File Deletion Sync** - Automatically delete files that no longer exist locally or on GitHub
- 📁 **Enhanced Folder Structure** - Organized structure with notebooks, plugins, config, and templates folders
- 🌐 **i18n Support** - English and Chinese (Simplified)

## 📦 Installation

### Option 1: From SiYuan Marketplace (Recommended)
1. Open SiYuan
2. Go to Settings → Marketplace → Plugins
3. Search for "Git Sync"
4. Click Install

### Option 2: Manual Installation
1. Download the latest release from [GitHub Releases](https://github.com/yourusername/siyuan-git-sync/releases)
2. Extract to `{SiYuan}/data/plugins/siyuan-git-sync/`
3. Restart SiYuan
4. Enable the plugin in Settings → Plugins

## 🚀 Quick Start

### Step 1: Create GitHub Repository
1. Go to https://github.com/new
2. Repository name: `siyuan-notes` (or any name you prefer)
3. Set to **Private** (recommended for personal notes)
4. **Don't** initialize with README
5. Click "Create repository"

### Step 2: Generate Personal Access Token
1. Go to https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Token name: `SiYuan Sync`
4. Expiration: Choose your preference (or "No expiration")
5. **Select scope**: Check the `repo` checkbox
6. Click "Generate token"
7. **⚠️ IMPORTANT**: Copy the token immediately (you won't see it again!)

### Step 3: Configure Plugin
1. Click the ☁️ cloud icon in SiYuan's top bar
2. Click "⚙️ Settings"
3. Fill in the following:
   - **Repository Owner**: Your GitHub username
   - **Repository Name**: Your repo name (e.g., `siyuan-notes`)
   - **Branch**: `main` (or `master` for older repos)
   - **GitHub Token**: Paste your Personal Access Token
   - **Author Name**: Your name for commit messages
   - **Author Email**: Your email for commit messages
4. Click "🔍 Test Connection" button
5. You should see: "✅ Connected to: username/repo"

### Step 4: Initial Sync

**If this is your first device:**
1. Click "📤 Push to GitHub"
2. Wait for completion
3. Check your GitHub repo - all notebooks should be there!

**If setting up a second device:**
1. Configure plugin with the SAME settings
2. Click "📥 Pull from GitHub"
3. All notes will be downloaded and imported

### Step 5: Enable Auto-Sync (Optional)
1. In plugin settings, check "Enable Auto-Sync"
2. Set interval (30 minutes recommended)
3. Save settings

## 💻 Multi-Device Workflow

### Setup Second Device
1. Install plugin on Device B
2. Use **exact same configuration** as Device A
3. Click "📥 Pull from GitHub"
4. Enable Auto-Sync

### Daily Usage
**Best Practice: Always Full Sync**
```
1. Open SiYuan
2. Click cloud icon → "🔄 Full Sync"
3. Work on your notes
4. Click "🔄 Full Sync" again before closing
```

**Or Use Auto-Sync**
- Set interval to 30+ minutes
- Plugin syncs automatically in background
- Always full sync when switching devices

## 📁 File Structure

Your GitHub repository will be organized as:

```
your-repo/
├── Daily Notes/
│   ├── 2025-01-15.md
│   ├── 2025-01-16.md
│   └── Week 3/
│       └── Summary.md
├── Work/
│   ├── Projects/
│   │   ├── Project A.md
│   │   └── Project B.md
│   └── Meetings.md
└── Personal/
    ├── Ideas.md
    └── Journal.md
```

Each SiYuan notebook becomes a folder, maintaining your hierarchy.

## ⚙️ Configuration Options

| Setting | Description | Required |
|---------|-------------|----------|
| Repository Owner | GitHub username or org | Yes |
| Repository Name | Repository name | Yes |
| Branch | Git branch to use | Yes |
| GitHub Token | PAT with `repo` scope | Yes |
| Author Name | Name for commits | Yes |
| Author Email | Email for commits | Yes |
| Auto-Sync | Enable automatic sync | No |
| Sync Interval | Minutes between syncs (min 5) | No |

## 🔍 Operations

### Push to GitHub
- Exports all SiYuan notes as Markdown
- Uploads new files to GitHub
- Updates changed files
- Shows summary of uploaded/updated files

### Pull from GitHub
- Downloads all `.md` files from GitHub
- Creates notebooks if they don't exist
- Creates/updates documents in SiYuan
- Shows summary of downloaded files

### Full Sync
- Pulls from GitHub first (gets remote changes)
- Then pushes to GitHub (sends local changes)
- **Recommended for multi-device usage**

### Status
- Shows local notebook and file counts
- Shows GitHub file count
- Displays current configuration

## ⚠️ Important Notes

### Conflict Handling
This plugin uses GitHub's REST API, not Git merge. **Last write wins**.

**To avoid conflicts:**
1. Always "Full Sync" before editing
2. Don't edit same files on multiple devices simultaneously
3. Use Auto-Sync with longer intervals (30+ min)

### File Deletion
Files deleted in SiYuan are **not** automatically deleted from GitHub (for safety).

To clean up:
1. Go to your GitHub repository
2. Manually delete unwanted files

### Rate Limits
- GitHub API: 5000 requests/hour for authenticated users
- Each file operation is one request
- For 100+ files, sync might take 1-2 minutes

## 🐛 Troubleshooting

### Settings Not Appearing
- Restart SiYuan
- Check console (F12) for errors
- Verify plugin is enabled in Settings → Plugins

### "Network error - check your internet connection"
- Verify you're online
- Check if GitHub is accessible: https://github.com
- Disable VPN and try again

### "Invalid token or authentication failed"
- Token might be expired - generate new one
- Ensure token has `repo` scope selected
- Copy token correctly (no extra spaces)

### "Repository not found or no access"
- Check Repository Owner spelling (case-sensitive)
- Check Repository Name spelling (case-sensitive)
- Verify repository exists at github.com/owner/repo
- Ensure repository isn't deleted

### "Access forbidden - check token permissions"
- Regenerate token with `repo` scope
- Make sure you checked the entire `repo` checkbox, not sub-items

### Files Not Appearing After Pull
- Refresh SiYuan (F5 or restart)
- Check browser console (F12) for errors
- Verify files exist on GitHub
- Check if correct branch is configured

### Pull Downloads 0 Files
- Repository might be empty
- Push from another device first
- Check branch name (might be `master` instead of `main`)

## 🔐 Security

- ✅ Use **Private** repositories for personal notes
- ✅ Store tokens securely (saved in SiYuan's data directory)
- ✅ Enable 2FA on your GitHub account
- ✅ Use token expiration and regenerate periodically
- ❌ Never share your Personal Access Token
- ❌ Never commit tokens to repositories

## 📊 Performance

Sync times (approximate):

| Workspace Size | Time |
|----------------|------|
| 10-50 files | 5-10 seconds |
| 50-200 files | 20-40 seconds |
| 200+ files | 1-2 minutes |

First sync is slower. Subsequent syncs only process changed files.

## 🛠️ Development

### Build from Source

```bash
# Clone repository
git clone https://github.com/yourusername/siyuan-git-sync.git
cd siyuan-git-sync

# Install dependencies
npm install

# Build plugin
npm run build

# Development mode (watch for changes)
npm run dev
```

### Project Structure

```
siyuan-git-sync/
├── src/
│   ├── index.ts          # Main plugin code
│   └── libs/
│       └── setting-utils.ts  # Settings utilities
├── i18n/
│   ├── en_US.json        # English translations
│   └── zh_CN.json        # Chinese translations
├── icon.png              # Plugin icon
├── preview.png           # Preview image
├── index.css             # Plugin styles
├── plugin.json           # Plugin metadata
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── README.md             # This file
└── LICENSE               # License file
```

### Dependencies

This plugin only requires:
- `siyuan`: SiYuan plugin SDK

**No other dependencies needed!** Pure TypeScript implementation.

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Areas for Contribution

- 🌐 Additional language translations
- 🎨 UI/UX improvements
- 🐛 Bug fixes
- 📖 Documentation improvements
- ✨ New features (with discussion first)

## 📝 Changelog

### Version 1.0.0 (2025-01-20)
- ✨ Initial release
- 📤 Push to GitHub support
- 📥 Pull from GitHub support
- 🔄 Full sync (two-way)
- ⏰ Auto-sync functionality
- 🔍 Connection testing
- 📊 Status view
- 🌐 English and Chinese support

## 🗺️ Roadmap

### Planned Features

- [ ] **Selective Sync** - Choose which notebooks to sync
- [ ] **Conflict Resolution UI** - Visual conflict resolution
- [ ] **Sync History** - View past sync operations
- [ ] **Commit History** - Browse GitHub commit history
- [ ] **Branch Management** - Create/switch branches
- [ ] **Diff Viewer** - See changes before syncing
- [ ] **Backup Before Sync** - Auto-backup option
- [ ] **Exclude Patterns** - Ignore certain files/folders
- [ ] **Sync Notifications** - Desktop notifications
- [ ] **Multiple Remotes** - Sync to multiple GitHub repos
- [ ] **GitLab/Gitea Support** - Support other Git hosts

### Future Enhancements

- **Incremental Sync** - Only sync changed files (already implemented for push)
- **Compression** - Reduce data transfer
- **Encryption** - Encrypt sensitive notes
- **Collaboration** - Share notebooks with others
- **Version Control** - Time-machine style restore

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [SiYuan](https://github.com/siyuan-note/siyuan) - The amazing note-taking app
- [GitHub REST API](https://docs.github.com/rest) - For sync capabilities
- All contributors and users of this plugin

## 💬 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/siyuan-git-sync/issues)
- 💡 **Feature Requests**: [GitHub Issues](https://github.com/yourusername/siyuan-git-sync/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/yourusername/siyuan-git-sync/discussions)
- 📧 **Email**: your.email@example.com

## ⭐ Show Your Support

If you find this plugin helpful, please:
- ⭐ Star the repository
- 🐦 Share it with others
- 🐛 Report bugs
- 💡 Suggest features
- 🤝 Contribute code

## 📚 Additional Resources

### Getting Started with GitHub
- [GitHub Quickstart](https://docs.github.com/en/get-started/quickstart)
- [Personal Access Tokens](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token)

### SiYuan Resources
- [SiYuan Official Site](https://b3log.org/siyuan/)
- [SiYuan Documentation](https://docs.siyuan-note.com/)
- [SiYuan Plugin Development](https://docs.siyuan-note.com/en/reference/plugin)

### Git & Version Control
- [Git Basics](https://git-scm.com/book/en/v2/Getting-Started-Git-Basics)
- [Understanding Git Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows)

## 🔧 Advanced Usage

### Custom Sync Strategies

#### Strategy 1: Separate Branches per Device
```
Device A → branch: device-a
Device B → branch: device-b
Merge manually when needed
```

**Pros**: No conflicts
**Cons**: Manual merging required

#### Strategy 2: Time-Based Notebooks
```
Morning Notes (Device A only)
Evening Notes (Device B only)
Shared Notes (Both devices)
```

**Pros**: Natural separation
**Cons**: Less flexible

#### Strategy 3: Auto-Sync with Manual Override
```
Auto-Sync: Every 60 minutes
Manual Full Sync: When switching devices
```

**Pros**: Best of both worlds
**Cons**: Requires discipline

### Environment Variables (Advanced)

For CI/CD or automation:

```bash
export SIYUAN_GIT_SYNC_TOKEN="ghp_xxxxx"
export SIYUAN_GIT_SYNC_REPO="username/repo"
export SIYUAN_GIT_SYNC_BRANCH="main"
```

### Using with GitHub Actions

You can automate backups with GitHub Actions:

```yaml
name: Daily Backup
on:
  schedule:
    - cron: '0 0 * * *'  # Daily at midnight
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger SiYuan Sync
        # Your automation logic here
```

## ❓ FAQ

### Q: Can I use this with GitLab or other Git services?
**A**: Currently only GitHub is supported. GitLab/Gitea support is planned.

### Q: What happens if I edit the same file on both devices?
**A**: Last write wins. Always full sync before editing to avoid losing changes.

### Q: Can I sync only specific notebooks?
**A**: Not yet. Selective sync is planned for a future version.

### Q: Is my data safe?
**A**: Yes, if you use a private repository. Never use public repos for sensitive notes.

### Q: Does this work offline?
**A**: No, internet connection required for syncing. Local changes are preserved until sync.

### Q: Can I see what changed before syncing?
**A**: Not yet. Diff viewer is planned for a future version.

### Q: How do I restore from a previous version?
**A**: Go to your GitHub repo, browse commit history, and manually copy the old version.

### Q: Can multiple people collaborate on the same repository?
**A**: Technically yes, but not recommended. Collaboration features are planned.

### Q: Does this delete files from GitHub if I delete them in SiYuan?
**A**: No, for safety. You must manually delete files from GitHub.

### Q: What if GitHub is down?
**A**: Sync will fail, but your local notes are safe. Try again when GitHub is back.

### Q: Can I use this with GitHub Enterprise?
**A**: Not currently. Only public GitHub.com is supported.

### Q: How much does this cost?
**A**: The plugin is free. You need a free GitHub account (private repos included).

---

**Made with ❤️ for the SiYuan community**

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/siyuan-git-sync/issues)!