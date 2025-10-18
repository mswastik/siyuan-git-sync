#!/bin/bash

###############################################################################
# SiYuan Git Sync Plugin - Automated Installer
# Usage: bash install.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_success() { echo -e "${GREEN}✓ $1${NC}"; }
print_error() { echo -e "${RED}✗ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠ $1${NC}"; }

echo "======================================================"
echo "  SiYuan Git Sync Plugin - Automated Installer"
echo "======================================================"
echo ""

# Detect OS
OS="unknown"
SIYUAN_PLUGINS_DIR=""

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    SIYUAN_PLUGINS_DIR="$HOME/.config/SiYuan/data/plugins"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="mac"
    SIYUAN_PLUGINS_DIR="$HOME/Library/Application Support/SiYuan/data/plugins"
elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
    OS="windows"
    SIYUAN_PLUGINS_DIR="$APPDATA/SiYuan/data/plugins"
fi

print_info "Detected OS: $OS"
print_info "Plugin directory: $SIYUAN_PLUGINS_DIR"
echo ""

# Check prerequisites
print_info "Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed!"
    print_info "Please install Node.js from: https://nodejs.org/"
    exit 1
fi
print_success "Node.js found: $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed!"
    exit 1
fi
print_success "npm found: $(npm --version)"

# Check if SiYuan is installed
if [ ! -d "$SIYUAN_PLUGINS_DIR" ]; then
    print_warning "SiYuan plugins directory not found!"
    print_info "Expected location: $SIYUAN_PLUGINS_DIR"
    read -p "Do you want to create it? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        mkdir -p "$SIYUAN_PLUGINS_DIR"
        print_success "Directory created"
    else
        print_error "Installation cancelled"
        exit 1
    fi
else
    print_success "SiYuan plugins directory found"
fi

echo ""
print_info "Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    print_error "Failed to install dependencies"
    exit 1
fi
print_success "Dependencies installed"

echo ""
print_info "Building plugin..."
npm run build

if [ $? -ne 0 ]; then
    print_error "Build failed"
    exit 1
fi
print_success "Plugin built successfully"

echo ""
print_info "Installing plugin to SiYuan..."

PLUGIN_DIR="$SIYUAN_PLUGINS_DIR/git-sync"

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Copy built files
cp -r dist/* "$PLUGIN_DIR/"

if [ $? -eq 0 ]; then
    print_success "Plugin installed to: $PLUGIN_DIR"
else
    print_error "Failed to copy plugin files"
    exit 1
fi

echo ""
echo "======================================================"
print_success "Installation Complete!"
echo "======================================================"
echo ""
print_info "Next steps:"
echo "  1. Restart SiYuan"
echo "  2. Look for the ☁️ cloud icon in the top bar"
echo "  3. Click it to configure your GitHub settings"
echo ""
print_info "Configuration needed:"
echo "  - GitHub Repository URL"
echo "  - GitHub Personal Access Token"
echo "  - Username and Email"
echo ""
print_info "For detailed setup instructions, see:"
echo "  - README.md (full documentation)"
echo "  - QUICKSTART.md (5-minute guide)"
echo ""
print_warning "Don't forget to create your GitHub token at:"
echo "  https://github.com/settings/tokens"
echo ""
print_success "Happy syncing! 🚀"
echo ""