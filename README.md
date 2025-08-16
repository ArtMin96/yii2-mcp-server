# Yii2 MCP Server

A Model Context Protocol (MCP) server for Yii2 framework, providing database schema inspection, console command execution, and project management tools for Claude Code.

## Features

### Database Tools
- **db_list_tables**: List all database tables with details (rows, size, comments)
- **db_describe_table**: Get detailed schema information for a specific table
- **db_table_relationships**: Analyze foreign key relationships 
- **db_execute_query**: Execute SELECT queries safely with results

### Yii2 Console Tools
- **yii_list_commands**: List all available Yii console commands with descriptions
- **yii_command_help**: Get detailed help for specific commands
- **yii_execute_command**: Execute safe console commands (dangerous commands blocked)
- **yii_list_migrations**: Show migration status (applied and pending)

### Model & Project Tools
- **yii_list_models**: List all ActiveRecord models with relationships
- **yii_analyze_model**: Analyze specific model classes
- **project_structure**: Get overview of project directory structure
- **module_info**: Detailed information about specific modules
- **config_inspect**: Inspect application configuration files

### Advanced Module Analysis
- **module_detailed_analysis**: Comprehensive module analysis including controllers, models, assets, widgets, jobs, services, and traits
- **asset_list_bundles**: List all asset bundles with CSS/JS files and dependencies
- **asset_analyze_dependencies**: Analyze asset dependency chains and registration order
- **widget_list**: Discover widgets and their associated asset bundles

## Installation

### Option 1: NPM Install (Recommended)

```bash
npm install -g yii2-mcp-server
```

Then configure Claude Code from your Yii2 project directory:
```bash
cd /path/to/your/yii2/project
claude mcp add yii2 yii2-mcp-server
```

### Option 2: Manual Installation

1. **Clone and Install**
   ```bash
   git clone https://github.com/ArtMin96/yii2-mcp-server.git
   cd yii2-mcp-server
   npm install
   npm run build
   ```

2. **Configure Claude Code**
   
   **Using Claude CLI:**
   ```bash
   cd /path/to/your/yii2/project
   claude mcp add yii2 node /path/to/yii2-mcp-server/dist/index.js
   ```
   
   **Manual JSON Configuration:**
   ```json
   {
     "mcpServers": {
       "yii2": {
         "command": "node",
         "args": ["/path/to/yii2-mcp-server/dist/index.js"],
         "cwd": "/path/to/your/yii2/project"
       }
     }
   }
   ```

## Configuration

The MCP server automatically detects your Yii2 project configuration:

### Database Configuration
The server looks for database configuration in this order:
1. `.env` file (for environment variables like `DB_HOST`, `DB_DATABASE`, etc.)
2. `config/db.php` file (falls back to default MySQL settings)

### Project Detection
- Must be run from a directory containing a `yii` console script
- Automatically scans `modules/`, `models/`, `config/` directories
- Supports standard Yii2 directory structure

## Usage Examples

Once configured, you can use these tools through Claude Code:

```
# Database Analysis
Use db_list_tables tool
Use db_describe_table with table_name: "user"

# Yii2 Console Commands
Use yii_list_commands
Use yii_list_migrations

# Project Structure
Use project_structure
Use yii_list_models with module: "fastnet"

# Advanced Module Analysis
Use module_detailed_analysis with module_name: "fastnet"
Use module_detailed_analysis with module_name: "billing"

# Asset Bundle Analysis
Use asset_list_bundles
Use asset_list_bundles with module_filter: "rbac"
Use asset_analyze_dependencies
Use asset_analyze_dependencies with asset_name: "AppAsset"

# Widget Discovery
Use widget_list
Use widget_list with module_filter: "fastnet"
```

### Module Analysis Features

**Comprehensive Module Understanding:**
- Controllers, models, views structure
- Asset bundles and their dependencies
- Widgets and custom components
- Queue jobs and service classes
- Traits and utility classes
- Bootstrap configuration

**Asset Bundle Intelligence:**
- CSS and JavaScript file mapping
- Dependency tree analysis
- Circular dependency detection
- Optimal registration order
- Source path resolution

**Widget Discovery:**
- Widget-to-asset-bundle relationships
- Module-specific widget organization
- Dependency mapping

## Safety Features

- **Read-Only Database Access**: Only SELECT queries allowed
- **Command Safety**: Dangerous commands (like `migrate/fresh`) are blocked
- **Configuration Security**: Sensitive config values are not exposed
- **Timeout Protection**: Commands have 30-second timeout limits
- **Interactive Command Detection**: Commands requiring user input are flagged

## Requirements

- Node.js 18+
- Yii2 project with console access
- MySQL database
- PHP CLI available in PATH

## Troubleshooting

### Common Issues

1. **"Yii script not found"**
   - Ensure you're running from the Yii2 project root directory
   - Check that the `yii` console script exists and is executable

2. **Database connection errors**
   - Verify your `.env` file has correct database credentials
   - Ensure MySQL is running and accessible
   - Check that the database specified in config exists

3. **Permission errors**
   - Ensure the server has read access to your project files
   - Check that PHP CLI is available and can execute the Yii script

### Debug Mode

For development and debugging, you can run the server directly:

```bash
npm run dev
```

This will watch for file changes and rebuild automatically.

## Development

The server is built with TypeScript and consists of:

- `src/index.ts` - Main MCP server setup and tool routing
- `src/database.ts` - Database connection and schema inspection
- `src/yii2.ts` - Yii2 console command execution and project analysis  
- `src/config.ts` - Configuration management and project detection

To contribute:

1. Fork the repository
2. Make your changes
3. Run `npm run build` to compile
4. Test with your Yii2 project
5. Submit a pull request

## License

MIT License - feel free to use in your projects!