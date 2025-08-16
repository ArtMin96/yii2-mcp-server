#!/bin/bash

# Yii2 MCP Server Installation Script

set -e

echo "🚀 Installing Yii2 MCP Server..."

# Check if we're in a Yii2 project
if [ ! -f "yii" ]; then
    echo "❌ Error: No 'yii' script found. Please run this from a Yii2 project root directory."
    exit 1
fi

echo "✅ Yii2 project detected"

# Check Node.js version
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Error: Node.js version 18+ required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
cd yii2-mcp-server
npm install

# Build the server
echo "🔨 Building TypeScript..."
npm run build

# Test the server
echo "🧪 Testing server..."
if timeout 2s node dist/index.js < /dev/null 2>&1 | grep -q "Yii2 MCP Server running"; then
    echo "✅ Server test passed"
else
    echo "❌ Server test failed"
    exit 1
fi

cd ..

# Add to Claude Code using CLI
echo "⚙️  Adding to Claude Code..."

# Check if claude command is available
if command -v claude &> /dev/null; then
    echo "📦 Adding MCP server using Claude CLI..."
    if claude mcp add yii2 node "$(pwd)/yii2-mcp-server/dist/index.js" --cwd "$(pwd)" 2>/dev/null; then
        echo "✅ MCP server added successfully using Claude CLI"
    else
        echo "⚠️  Claude CLI failed, creating manual configuration..."
        
        # Fallback to manual configuration
        mkdir -p .claude
        CONFIG_FILE=".claude/claude_desktop_config.json"
        if [ -f "$CONFIG_FILE" ]; then
            echo "📝 Configuration file exists. Please manually add:"
            echo "   claude mcp add yii2 node $(pwd)/yii2-mcp-server/dist/index.js --cwd $(pwd)"
        else
            cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "yii2": {
      "command": "node",
      "args": ["$(pwd)/yii2-mcp-server/dist/index.js"],
      "cwd": "$(pwd)"
    }
  }
}
EOF
            echo "✅ Manual configuration created at $CONFIG_FILE"
        fi
    fi
else
    echo "📝 Claude CLI not found, creating manual configuration..."
    
    # Fallback to manual configuration
    mkdir -p .claude
    CONFIG_FILE=".claude/claude_desktop_config.json"
    if [ -f "$CONFIG_FILE" ]; then
        echo "📝 Configuration file exists at $CONFIG_FILE"
        echo "   Please manually run:"
        echo "   claude mcp add yii2 node $(pwd)/yii2-mcp-server/dist/index.js --cwd $(pwd)"
    else
        cat > "$CONFIG_FILE" << EOF
{
  "mcpServers": {
    "yii2": {
      "command": "node",
      "args": ["$(pwd)/yii2-mcp-server/dist/index.js"],
      "cwd": "$(pwd)"
    }
  }
}
EOF
        echo "✅ Manual configuration created at $CONFIG_FILE"
        echo "   Or run: claude mcp add yii2 node $(pwd)/yii2-mcp-server/dist/index.js --cwd $(pwd)"
    fi
fi

echo ""
echo "🎉 Yii2 MCP Server installation complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Restart Claude Code to load the new MCP server"
echo "   2. Test the connection with: Use the 'project_structure' tool"
echo "   3. Explore database with: Use the 'db_list_tables' tool"
echo ""
echo "📖 Available tools:"
echo "   • Database: db_list_tables, db_describe_table, db_table_relationships, db_execute_query"
echo "   • Yii2: yii_list_commands, yii_command_help, yii_execute_command, yii_list_migrations"
echo "   • Models: yii_list_models, yii_analyze_model"
echo "   • Project: project_structure, module_info, config_inspect"
echo "   • Advanced Modules: module_detailed_analysis"
echo "   • Assets: asset_list_bundles, asset_analyze_dependencies"
echo "   • Widgets: widget_list"
echo ""
echo "🔗 For more information, see: yii2-mcp-server/README.md"