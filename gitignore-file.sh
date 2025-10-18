# Dependencies
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml

# Build output
dist/
build/
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo
*~
.DS_Store

# Testing
coverage/
.nyc_output/

# Environment
.env
.env.local
.env.*.local

# Temporary files
*.tmp
*.temp
.cache/

# SiYuan specific (for workspace sync, not plugin development)
# Uncomment if you're syncing your workspace separately
# .siyuan/
# temp/
# history/

# Config (contains tokens - NEVER commit this!)
git-sync-config.json

# OS files
Thumbs.db
ehthumbs.db
Desktop.ini