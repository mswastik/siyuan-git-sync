# Quick Setup Guide

Follow these steps to get your SiYuan notes syncing with GitHub in under 5 minutes!

## 📋 Prerequisites

- SiYuan installed and running
- A GitHub account (sign up free at https://github.com)
- Internet connection

## 🚀 Setup Steps

### 1️⃣ Create GitHub Repository (2 minutes)

1. Go to https://github.com/new
2. Fill in:
   - **Repository name**: `siyuan-notes` (or your choice)
   - **Description**: "My SiYuan Notes Backup"
   - **Visibility**: Select **Private** 🔒
   - **DO NOT** check "Add a README file"
3. Click **"Create repository"**
4. Keep this page open - you'll need the repository info

### 2️⃣ Generate GitHub Token (2 minutes)

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. Fill in:
   - **Note**: `SiYuan Sync Plugin`
   - **Expiration**: Choose "No expiration" (or your preference)
   - **Scopes**: Check the **`repo`** checkbox (this checks all sub-items)
4. Scroll down and click **"Generate token"**
5. **🚨 IMPORTANT**: Copy the token NOW
   ```
   Example: ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```
6. Save it somewhere safe (you'll paste it in next step)

### 3️⃣ Configure Plugin (1 minute)

1. In SiYuan, look for the **☁️ cloud icon** in the top bar
2. Click it, then click **"⚙️ Settings"**
3. Fill in the form:

   | Field | Example | Your Value |
   |-------|---------|------------|
   | **Repository Owner** | `john-doe` | __________ |
   | **Repository Name** | `siyuan-notes` | __________ |
   | **Branch** | `main` | `main` |
   | **GitHub Token** | `ghp_xxx...` | __________ |
   | **Author Name** | `John Doe` | __________ |
   | **Author Email** | `john@example.com` | __________ |

4. Click **"🔍 Test Connection"** button
5. Wait for: **"✅ Connected to: your-username/repo-name"**

   ❌ If you see an error:
   - Check Repository Owner/Name spelling (case-sensitive!)
   - Verify token was copied correctly
   - Make sure repo exists on GitHub

### 4️⃣ First Sync! (Less than 1 minute)

**Choose ONE option:**

#### Option A: You're setting up your first device
1. Click the ☁️ cloud icon
2. Click **"📤 Push to GitHub"**
3. Wait for completion
4. Go to your GitHub repo - your notes are there! 🎉

#### Option B: You're setting up a second device
1. Click the ☁️ cloud icon
2. Click **"📥 Pull from GitHub"**
3. Wait for completion
4. Your notes appear in SiYuan! 🎉

### 5️⃣ Enable Auto-Sync (Optional, 30 seconds)

1. Click ☁️ → ⚙️ Settings
2. Check **"Enable Auto-Sync"**
3. Set **"Sync Interval"** to `30` (minutes)
4. Your notes will auto-backup every 30 minutes! ✨

## ✅ You're Done!

Your SiYuan notes are now backed up to GitHub!

## 📖 Daily Usage

### Single Device
Just keep working! Auto-sync handles everything.

### Two Devices
**When you switch devices:**
1. Open SiYuan on new device
2. Click ☁️ → **"🔄 Full Sync"**
3. Work on your notes
4. Click **"🔄 Full Sync"** again before closing
5. Switch to other device, repeat!

## 🆘 Quick Troubleshooting

### "Network error"
- ✅ Check your internet connection
- ✅ Visit https://github.com to verify GitHub is accessible

### "Invalid token"
- ✅ Go back to step 2️⃣ and generate a new token
- ✅ Make sure you checked the `repo` scope
- ✅ Copy the ENTIRE token (no spaces)

### "Repository not found"
- ✅ Check spelling (case-sensitive!)
- ✅ Make sure you created the repository
- ✅ Verify it's not deleted

### "Settings not appearing"
- ✅ Restart SiYuan
- ✅ Make sure plugin is enabled in Settings → Plugins
- ✅ Check browser console (F12) for errors

### Files not syncing
- ✅ Click "📊 Status" to check counts
- ✅ Try "🔄 Full Sync" again
- ✅ Check GitHub repo to see if files appear there

## 💡 Pro Tips

1. **Use Full Sync**: It's safer than just push or pull
2. **Set longer intervals**: 30-60 minutes is good for auto-sync
3. **Private repository**: Keep your notes secure
4. **Test connection**: Always test after changing settings
5. **Regular backups**: Even with Git, keep SiYuan's backups too

## 🎯 Next Steps

- ⭐ Star the plugin repository
- 📖 Read the full [README.md](README.md) for advanced features
- 💬 Join discussions if you have questions
- 🐛 Report bugs to help improve the plugin

## 📞 Need Help?

- 📖 **Full Documentation**: See [README.md](README.md)
- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/yourusername/siyuan-git-sync/issues)
- 💬 **Questions**: [GitHub Discussions](https://github.com/yourusername/siyuan-git-sync/discussions)

---

**Happy note-taking! 📝✨**