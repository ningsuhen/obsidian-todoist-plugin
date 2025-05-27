#!/bin/bash

# 🧪 ADHD-Optimized Todoist Plugin Installation Test Script
# This script helps you test the plugin installation in a real Obsidian environment

echo "🧠 ADHD-Optimized Todoist Plugin Installation Test"
echo "=================================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_step() {
    echo -e "${BLUE}📋 $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Check if plugin files exist
print_step "Checking plugin build files..."
if [ ! -f "plugin/dist/main.js" ] || [ ! -f "plugin/dist/manifest.json" ] || [ ! -f "plugin/dist/styles.css" ]; then
    print_error "Plugin files not found! Please run 'cd plugin && npm run build' first."
    exit 1
fi
print_success "Plugin files found!"

# Step 2: Find Obsidian vault
print_step "Looking for Obsidian vaults..."

# Common Obsidian vault locations
VAULT_LOCATIONS=(
    "$HOME/Documents"
    "$HOME/Desktop"
    "$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents"
    "$HOME/iCloud Drive (Archive)/iCloud~md~obsidian"
    "$HOME/Obsidian"
)

FOUND_VAULTS=()

for location in "${VAULT_LOCATIONS[@]}"; do
    if [ -d "$location" ]; then
        # Look for .obsidian folders (indicating vaults)
        while IFS= read -r -d '' vault; do
            vault_name=$(basename "$(dirname "$vault")")
            FOUND_VAULTS+=("$(dirname "$vault")")
            echo "  📁 Found vault: $vault_name at $(dirname "$vault")"
        done < <(find "$location" -name ".obsidian" -type d -print0 2>/dev/null)
    fi
done

if [ ${#FOUND_VAULTS[@]} -eq 0 ]; then
    print_warning "No Obsidian vaults found automatically."
    echo "Please manually specify your vault path when prompted."
    echo ""
    echo "To find your vault:"
    echo "1. Open Obsidian"
    echo "2. Go to Settings → About"
    echo "3. Look for 'Vault path'"
    echo ""
    read -p "Enter your vault path: " VAULT_PATH
else
    echo ""
    echo "Select a vault for testing:"
    for i in "${!FOUND_VAULTS[@]}"; do
        echo "  $((i+1)). $(basename "${FOUND_VAULTS[$i]}")"
    done
    echo "  $((${#FOUND_VAULTS[@]}+1)). Enter custom path"
    echo ""
    
    read -p "Choose vault (1-$((${#FOUND_VAULTS[@]}+1))): " choice
    
    if [ "$choice" -le "${#FOUND_VAULTS[@]}" ] && [ "$choice" -gt 0 ]; then
        VAULT_PATH="${FOUND_VAULTS[$((choice-1))]}"
    else
        read -p "Enter your vault path: " VAULT_PATH
    fi
fi

# Validate vault path
if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    print_error "Invalid vault path: $VAULT_PATH"
    print_error "Make sure the path contains a .obsidian folder"
    exit 1
fi

print_success "Using vault: $(basename "$VAULT_PATH")"

# Step 3: Install plugin
print_step "Installing plugin..."

PLUGIN_DIR="$VAULT_PATH/.obsidian/plugins/obsidian-todoist-plugin-adhd"

# Create plugin directory
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
cp plugin/dist/main.js "$PLUGIN_DIR/"
cp plugin/dist/manifest.json "$PLUGIN_DIR/"
cp plugin/dist/styles.css "$PLUGIN_DIR/"

print_success "Plugin files copied to: $PLUGIN_DIR"

# Step 4: Enable plugin in Obsidian settings
print_step "Plugin installation complete!"
echo ""
echo "🎯 Next Steps:"
echo "1. Open Obsidian"
echo "2. Go to Settings → Community Plugins"
echo "3. Find '🧠 ADHD-Optimized Todoist Plugin' and enable it"
echo "4. The plugin will prompt you for your Todoist API token"
echo "5. Follow the zero-configuration setup process"
echo ""
echo "🧪 What to Test:"
echo "• Folder structure creation in 📋 01-PRODUCTIVITY/todoist-integration/"
echo "• Local workspace (📁 Local/) - your private space"
echo "• Agent guidelines file (.agent-guidelines.md)"
echo "• ADHD-optimized settings and feedback"
echo "• Sync commands in Command Palette"
echo ""
echo "📁 Expected Structure:"
echo "📋 01-PRODUCTIVITY/todoist-integration/"
echo "├── .agent-guidelines.md    # AI instructions"
echo "├── 📥 Inbox.md             # Auto sync"
echo "├── 📅 Today.md             # Auto sync"
echo "├── 📆 Upcoming.md          # Auto sync"
echo "├── 🗂️ Projects/            # Auto sync"
echo "├── 🏷️ Labels/              # Auto sync"
echo "├── 📁 Local/               # Never syncs (your space!)"
echo "└── ⚙️ System/              # Plugin internals"
echo ""
print_success "Ready for testing! 🚀"
