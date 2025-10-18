# 🚀 Quick Start Guide - Git Sync for SiYuan

Get up and running in **5 minutes**!

## 📋 What You Need

1. ✅ SiYuan installed (v3.0.0+)
2. ✅ GitHub account
3. ✅ Node.js installed (for building)

## ⚡ Super Quick Setup (Copy-Paste)

### Step 1: Create GitHub Token (2 minutes)

```
1. Go to: https://github.com/settings/tokens
2. Click "Generate new token (classic)"
3. Name: "SiYuan Sync"
4. Check: ✅ repo (Full control of private repositories)
5. Click "Generate token"
6. Copy the token (starts with ghp_)
```

### Step 2: Create Repository (1 minute)

```
1. Go to: https://github.com/new
2. Name: siyuan-backup
3. Select: 🔒 Private
4. Don't check any boxes
5. Click "Create repository"
6. Copy URL: https://github.com/YOUR_USERNAME/siyuan-backup.git
```

### Step 3: Install Plugin (2 minutes)

**Option A: Pre-built (If available)**

Download from releases: https://github.com/mswastik/siyuan-git-sync/releases

**Option B: Build from source**

```bash
# 1. Clone repository
git clone https://github.com/mswastik/siyuan-git-sync.git
cd siyuan-git-sync

# 2. Install & build (one command)
npm install && npm run build

# 3. The plugin is now in the 'dist' folder
```

**Desktop Installation:**

Windows:
```powershell
# Copy to SiYuan plugins folder
xcopy dist "C:\Users\YOUR_NAME\AppData\Roaming\SiYuan\data\plugins\git-sync\" /E /I
```

Mac/Linux:
```bash
# Copy to SiYuan plugins folder
mkdir -p ~/.config/SiYuan/data/plugins/git-sync
cp -r dist/* ~/.config/SiYuan/data/plugins/git-sync/
```

**Android Installation:**

1. Connect phone to computer
2. Navigate to: `Internal Storage/Android/data/org.b3log.siyuan/files/siyuan/data/plugins/`
3. Create folder: `git-sync`
4. Copy all files from `dist` folder to `git-sync` folder

### Step 4: Configure Plugin (30 seconds)

1. **Restart SiYuan**
2. Click the **☁️ cloud icon** in top bar
3. Go to Settings or click the cloud icon again
4. Fill in:
   ```
   Repository Owner: YOUR_USERNAME
   Repository Name: siyuan-backup
   Branch: main
   GitHub Token: ghp_YOUR_TOKEN_HERE
   Author Name: Your Name
   Author Email: you@example.com
   ```
5. Click **Save Configuration**
6. Click **Test Connection** - should see ✅ Success!

## 🎯 First Sync

1. Click **☁️ cloud icon**
2. Select **🔄 Full Sync**
3. Wait for "✅ Full sync completed" message
4. Check GitHub - your files are there!

## ⚙️ Enable Auto-Sync (Optional)

In plugin settings:
1. Check ✅ **Enable Auto-Sync**
2. Set interval: **60 minutes** (or your preference)
3. Save

Done! Your notes will auto-sync every hour.

## 🆘 Common Issues & Fixes

### Issue: "Authentication failed"
**Fix:** 
- Token incorrect - regenerate at https://github.com/settings/tokens
- Make sure token has `repo` scope checked

### Issue: "Plugin not showing"
**Fix:**
- Restart SiYuan completely
- Check plugin folder path is correct
- Make sure all files from `dist` were copied

### Issue: "Module not found" error
**Fix:**
- Rebuild plugin: `npm run build`
- Make sure `node_modules` was installed: `npm install`

### Issue: Android - Plugin doesn't load
**Fix:**
- Verify SiYuan version is 3.0.0+
- Check folder path: `/sdcard/Android/data/org.b3log.siyuan/files/siyuan/data/plugins/git-sync/`
- All files must be there: `index.js`, `plugin.json`, etc.

## 📱 Testing on Both Platforms

**Desktop:**
1. Make changes in SiYuan
2. Sync to GitHub
3. Verify files on github.com

**Android:**
1. Open SiYuan on phone
2. Pull from GitHub
3. Verify changes appear
4. Make new changes
5. Push to GitHub
6. Check on desktop

## 🔐 Security Checklist

- ✅ Repository is **Private**
- ✅ Token has only `repo` scope (not admin)
- ✅ Token is saved only in SiYuan settings
- ✅ Never commit token to repository
- ✅ Don't share token with anyone

## 📊 Sync Workflow

```
┌─────────────┐
│   Desktop   │ ←──── Make changes
└──────┬──────┘
       │ Push ⬆️
       ▼
┌─────────────┐
│   GitHub    │ ←──── Central storage
└──────┬──────┘
       │ Pull ⬇️
       ▼
┌─────────────┐
│   Android   │ ←──── See changes
└─────────────┘
```

## 🎓 Next Steps

**Daily Usage:**
- Work normally in SiYuan
- Click sync when you want to backup
- Or enable auto-sync and forget about it

**Advanced:**
- View commit history on GitHub
- Revert to previous versions if needed
- Clone to multiple devices
- Set up more frequent auto-sync

**Customization:**
- Adjust sync interval in settings
- Add .gitignore for specific files
- Create multiple branches for different purposes

## 💡 Pro Tips

1. **Sync before important edits** - Safety net if something goes wrong
2. **Use private repos** - Your notes are personal
3. **Regular syncing** - Prevents large sync conflicts
4. **Check GitHub web** - Verify backups are there
5. **Android battery** - Auto-sync uses minimal battery

## 📞 Need Help?

- 📖 Read full README.md for details
- 🐛 Report issues on GitHub
- 💬 Ask in SiYuan community forums
- 📧 Contact plugin developer

## ✅ Success Checklist

After setup, you should:
- ✅ See cloud icon in SiYuan top bar
- ✅ Test Connection shows success
- ✅ First sync completes without errors
- ✅ Files visible on github.com
- ✅ Can sync from both desktop and Android

**If all checked - you're done! 🎉**

---

**Plugin Advantages:**
- ✅ Works on Android
- ✅ No Git CLI needed
- ✅ Visual interface
- ✅ Auto-sync
- ✅ Status checking
- ✅ File deletion sync
- ✅ Enhanced folder structure

---

**Choose what works best for you! Both solutions are valid.** 🚀