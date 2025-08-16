#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { DatabaseManager } from "./database.js";
import { Yii2Manager } from "./yii2.js";
import { ConfigManager } from "./config.js";
class Yii2MCPServer {
    server;
    dbManager;
    yii2Manager;
    configManager;
    constructor() {
        this.server = new Server({
            name: "yii2-mcp-server",
            version: "1.0.0",
        }, {
            capabilities: {
                tools: {},
            },
        });
        this.configManager = new ConfigManager();
        this.dbManager = new DatabaseManager(this.configManager);
        this.yii2Manager = new Yii2Manager(this.configManager);
        this.setupToolHandlers();
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    // Database Tools
                    {
                        name: "db_list_tables",
                        description: "List all database tables with their details",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "db_describe_table",
                        description: "Get detailed schema information for a specific table",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: {
                                    type: "string",
                                    description: "Name of the table to describe",
                                },
                            },
                            required: ["table_name"],
                        },
                    },
                    {
                        name: "db_table_relationships",
                        description: "Get foreign key relationships for a table",
                        inputSchema: {
                            type: "object",
                            properties: {
                                table_name: {
                                    type: "string",
                                    description: "Name of the table to analyze relationships",
                                },
                            },
                            required: ["table_name"],
                        },
                    },
                    {
                        name: "db_execute_query",
                        description: "Execute a SELECT query on the database",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "SELECT SQL query to execute",
                                },
                                limit: {
                                    type: "number",
                                    description: "Limit the number of results (default: 100)",
                                    default: 100,
                                },
                            },
                            required: ["query"],
                        },
                    },
                    // Yii2 Tools
                    {
                        name: "yii_list_commands",
                        description: "List all available Yii console commands",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "yii_command_help",
                        description: "Get help information for a specific Yii command",
                        inputSchema: {
                            type: "object",
                            properties: {
                                command: {
                                    type: "string",
                                    description: "Yii command to get help for (e.g., 'migrate/up')",
                                },
                            },
                            required: ["command"],
                        },
                    },
                    {
                        name: "yii_execute_command",
                        description: "Execute a Yii console command",
                        inputSchema: {
                            type: "object",
                            properties: {
                                command: {
                                    type: "string",
                                    description: "Yii command to execute (e.g., 'migrate/status')",
                                },
                                args: {
                                    type: "array",
                                    items: { type: "string" },
                                    description: "Additional command arguments",
                                    default: [],
                                },
                                interactive: {
                                    type: "boolean",
                                    description: "Whether command requires user interaction (default: false)",
                                    default: false,
                                },
                            },
                            required: ["command"],
                        },
                    },
                    {
                        name: "yii_list_migrations",
                        description: "List migration status (applied and pending)",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "yii_list_models",
                        description: "List all ActiveRecord models in the application",
                        inputSchema: {
                            type: "object",
                            properties: {
                                module: {
                                    type: "string",
                                    description: "Filter models by module (optional)",
                                },
                            },
                            required: [],
                        },
                    },
                    {
                        name: "yii_analyze_model",
                        description: "Analyze an ActiveRecord model for relationships and properties",
                        inputSchema: {
                            type: "object",
                            properties: {
                                model_class: {
                                    type: "string",
                                    description: "Fully qualified model class name",
                                },
                            },
                            required: ["model_class"],
                        },
                    },
                    // Project Tools
                    {
                        name: "project_structure",
                        description: "Get an overview of the project structure and modules",
                        inputSchema: {
                            type: "object",
                            properties: {},
                            required: [],
                        },
                    },
                    {
                        name: "module_info",
                        description: "Get detailed information about a specific module",
                        inputSchema: {
                            type: "object",
                            properties: {
                                module_name: {
                                    type: "string",
                                    description: "Name of the module to analyze",
                                },
                            },
                            required: ["module_name"],
                        },
                    },
                    {
                        name: "config_inspect",
                        description: "Inspect application configuration",
                        inputSchema: {
                            type: "object",
                            properties: {
                                config_type: {
                                    type: "string",
                                    enum: ["web", "console", "db", "params"],
                                    description: "Type of configuration to inspect",
                                },
                            },
                            required: ["config_type"],
                        },
                    },
                    // Advanced Module Tools
                    {
                        name: "module_detailed_analysis",
                        description: "Get comprehensive analysis of a module including structure, dependencies, and assets",
                        inputSchema: {
                            type: "object",
                            properties: {
                                module_name: {
                                    type: "string",
                                    description: "Name of the module to analyze in detail",
                                },
                            },
                            required: ["module_name"],
                        },
                    },
                    // Asset Management Tools
                    {
                        name: "asset_list_bundles",
                        description: "List all asset bundles in the application with their details",
                        inputSchema: {
                            type: "object",
                            properties: {
                                module_filter: {
                                    type: "string",
                                    description: "Filter assets by specific module (optional)",
                                },
                            },
                            required: [],
                        },
                    },
                    {
                        name: "asset_analyze_dependencies",
                        description: "Analyze asset bundle dependencies and registration order",
                        inputSchema: {
                            type: "object",
                            properties: {
                                asset_name: {
                                    type: "string",
                                    description: "Specific asset bundle to analyze (optional - analyzes all if not provided)",
                                },
                            },
                            required: [],
                        },
                    },
                    // Widget Discovery Tools
                    {
                        name: "widget_list",
                        description: "List all widgets in the application with their asset bundles",
                        inputSchema: {
                            type: "object",
                            properties: {
                                module_filter: {
                                    type: "string",
                                    description: "Filter widgets by specific module (optional)",
                                },
                            },
                            required: [],
                        },
                    },
                ],
            };
        });
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            const { name, arguments: args } = request.params;
            try {
                switch (name) {
                    // Database Tools
                    case "db_list_tables":
                        return await this.dbManager.listTables();
                    case "db_describe_table":
                        return await this.dbManager.describeTable(args?.table_name);
                    case "db_table_relationships":
                        return await this.dbManager.getTableRelationships(args?.table_name);
                    case "db_execute_query":
                        return await this.dbManager.executeQuery(args?.query, args?.limit || 100);
                    // Yii2 Tools
                    case "yii_list_commands":
                        return await this.yii2Manager.listCommands();
                    case "yii_command_help":
                        return await this.yii2Manager.getCommandHelp(args?.command);
                    case "yii_execute_command":
                        return await this.yii2Manager.executeCommand(args?.command, args?.args || [], args?.interactive || false);
                    case "yii_list_migrations":
                        return await this.yii2Manager.listMigrations();
                    case "yii_list_models":
                        return await this.yii2Manager.listModels(args?.module);
                    case "yii_analyze_model":
                        return await this.yii2Manager.analyzeModel(args?.model_class);
                    // Project Tools
                    case "project_structure":
                        return await this.yii2Manager.getProjectStructure();
                    case "module_info":
                        return await this.yii2Manager.getModuleInfo(args?.module_name);
                    case "config_inspect":
                        return await this.yii2Manager.inspectConfig(args?.config_type);
                    // Advanced Module Tools
                    case "module_detailed_analysis":
                        return await this.yii2Manager.getDetailedModuleInfo(args?.module_name);
                    // Asset Management Tools
                    case "asset_list_bundles":
                        return await this.yii2Manager.listAssetBundles(args?.module_filter);
                    case "asset_analyze_dependencies":
                        return await this.yii2Manager.analyzeAssetDependencies(args?.asset_name);
                    // Widget Discovery Tools
                    case "widget_list":
                        return await this.yii2Manager.listWidgets(args?.module_filter);
                    default:
                        throw new Error(`Unknown tool: ${name}`);
                }
            }
            catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error executing ${name}: ${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                };
            }
        });
    }
    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Yii2 MCP Server running on stdio");
    }
}
const server = new Yii2MCPServer();
server.run().catch(console.error);
//# sourceMappingURL=index.js.map