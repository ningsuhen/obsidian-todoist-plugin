#!/bin/bash

# ADHD-Optimized Todoist Plugin Installation Script
# This script helps you install the plugin for testing

echo "🧠 ADHD-Optimized Todoist Plugin Installer"
echo "=========================================="
echo ""

# Use the specific vault path for ningsuhen's setup
VAULT_PATH="/Users/ningsuhen/Obsidian-Local/vimwiki"

echo "🔍 Using vault: $VAULT_PATH"

# Verify the vault exists
if [ ! -d "$VAULT_PATH" ]; then
    echo "❌ Vault directory not found at: $VAULT_PATH"
    echo "   Please make sure the vault exists."
    exit 1
fi

if [ ! -d "$VAULT_PATH/.obsidian" ]; then
    echo "❌ Not an Obsidian vault (no .obsidian directory found)"
    exit 1
fi

echo "✅ Vault verified: $VAULT_PATH"

# Create plugins directory if it doesn't exist
PLUGINS_DIR="$VAULT_PATH/.obsidian/plugins"
PLUGIN_DIR="$PLUGINS_DIR/obsidian-todoist-plugin-adhd"

echo "📁 Creating plugin directory..."
mkdir -p "$PLUGIN_DIR"

# Copy plugin files
echo "📋 Copying plugin files..."

# Check if we're in the plugin directory or parent directory
if [ -f "plugin/dist/main.js" ]; then
    # We're in the parent directory
    cp plugin/dist/main.js "$PLUGIN_DIR/"
    cp plugin/dist/styles.css "$PLUGIN_DIR/"
    cp plugin/dist/manifest.json "$PLUGIN_DIR/"
elif [ -f "dist/main.js" ]; then
    # We're in the plugin directory
    cp dist/main.js "$PLUGIN_DIR/"
    cp dist/styles.css "$PLUGIN_DIR/"
    cp dist/manifest.json "$PLUGIN_DIR/"
else
    echo "❌ Plugin build files not found. Please run 'npm run build' first."
    exit 1
fi

echo ""
echo "🎉 Installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Open Obsidian"
echo "   2. Go to Settings → Community Plugins"
echo "   3. Enable '🧠 ADHD-Optimized Todoist Plugin'"
echo "   4. The ADHD-optimized setup will start automatically!"
echo ""
echo "🧠 ADHD Features you'll experience:"
echo "   ✨ Zero-configuration setup (just enter your API token)"
echo "   🎯 Cognitive load reduction with minimal decisions"
echo "   🎉 Dopamine-friendly feedback and celebrations"
echo "   📁 Integration with your existing '📋 01-PRODUCTIVITY/todoist-integration' folder"
echo "   🔄 Bidirectional sync with Todoist"
echo ""
echo "📁 Your existing folder structure will be enhanced:"
echo "   → '📋 01-PRODUCTIVITY/todoist-integration/' will be used for task organization"
echo "   → Your existing subfolders (p0-priority-tasks, project-contexts, etc.) will be preserved"
echo "   → New tasks will be organized according to your existing structure"
echo ""
echo "🔑 You'll need your Todoist API token:"
echo "   → Go to https://todoist.com/help/articles/find-your-api-token-Jpzx9IIlB"
echo "   → Copy your API token"
echo "   → Paste it when the setup wizard appears"
echo ""
echo "Happy productivity! 🚀"
