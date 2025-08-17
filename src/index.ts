#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import { DatabaseManager } from "./database.js";
import { Yii2Manager } from "./yii2.js";
import { ConfigManager } from "./config.js";

class Yii2MCPServer {
  private server: Server;
  private dbManager: DatabaseManager;
  private yii2Manager: Yii2Manager;
  private configManager: ConfigManager;

  constructor() {
    this.server = new Server(
      {
        name: "yii2-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.configManager = new ConfigManager();
    this.dbManager = new DatabaseManager(this.configManager);
    this.yii2Manager = new Yii2Manager(this.configManager);

    this.setupToolHandlers();
  }

  private setupToolHandlers() {
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
          
          // Migration Management Tools
          {
            name: "migration_create",
            description: "Create a new migration with smart templates",
            inputSchema: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Migration name (e.g., 'add_column_to_user')",
                },
                template: {
                  type: "string", 
                  description: "Migration template type",
                  enum: ["table", "column", "index", "foreign_key", "data", "junction", "drop_table"],
                  default: "table"
                },
                table_name: {
                  type: "string",
                  description: "Table name for table-related migrations",
                },
                options: {
                  type: "object",
                  description: "Additional options specific to migration type",
                },
              },
              required: ["name"],
            },
          },
          {
            name: "migration_diff",
            description: "Show differences between applied and pending migrations",
            inputSchema: {
              type: "object",
              properties: {
                detailed: {
                  type: "boolean",
                  description: "Show detailed migration content differences",
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: "migration_rollback",
            description: "Safely rollback migrations with dependency checking",
            inputSchema: {
              type: "object",
              properties: {
                steps: {
                  type: "number",
                  description: "Number of migration steps to rollback",
                  default: 1,
                },
                dry_run: {
                  type: "boolean", 
                  description: "Preview rollback without executing",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "migration_generate_from_model",
            description: "Generate migration from model class changes",
            inputSchema: {
              type: "object",
              properties: {
                model_class: {
                  type: "string",
                  description: "Model class to generate migration from",
                },
                compare_with_table: {
                  type: "boolean",
                  description: "Compare model with existing table structure",
                  default: true,
                },
              },
              required: ["model_class"],
            },
          },

          // Code Generation Tools
          {
            name: "generate_crud",
            description: "Generate CRUD controller, views, and search model",
            inputSchema: {
              type: "object",
              properties: {
                model_class: {
                  type: "string",
                  description: "Model class name for CRUD generation",
                },
                controller_id: {
                  type: "string",
                  description: "Controller ID (optional, derived from model if not provided)",
                },
                module: {
                  type: "string",
                  description: "Target module for generation",
                },
                base_controller_class: {
                  type: "string",
                  description: "Base controller class to extend",
                  default: "yii\\web\\Controller",
                },
                enable_i18n: {
                  type: "boolean",
                  description: "Enable internationalization",
                  default: true,
                },
              },
              required: ["model_class"],
            },
          },
          {
            name: "generate_model",
            description: "Generate ActiveRecord model from database table",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string", 
                  description: "Database table name",
                },
                model_class: {
                  type: "string",
                  description: "Model class name (optional)",
                },
                namespace: {
                  type: "string",
                  description: "Model namespace",
                  default: "app\\models",
                },
                base_class: {
                  type: "string",
                  description: "Base model class to extend",
                  default: "yii\\db\\ActiveRecord",
                },
                generate_relations: {
                  type: "boolean",
                  description: "Generate relationship methods",
                  default: true,
                },
                generate_labels: {
                  type: "boolean",
                  description: "Generate attribute labels",
                  default: true,
                },
              },
              required: ["table_name"],
            },
          },
          {
            name: "generate_api",
            description: "Generate REST API endpoints for a model",
            inputSchema: {
              type: "object",
              properties: {
                model_class: {
                  type: "string",
                  description: "Model class for API generation",
                },
                api_version: {
                  type: "string",
                  description: "API version",
                  default: "v1",
                },
                base_url: {
                  type: "string",
                  description: "Base API URL pattern",
                },
                enable_auth: {
                  type: "boolean",
                  description: "Enable authentication",
                  default: true,
                },
                serializer_fields: {
                  type: "array",
                  items: { type: "string" },
                  description: "Fields to include in API response",
                },
              },
              required: ["model_class"],
            },
          },
          {
            name: "generate_form",
            description: "Generate ActiveForm with validation rules",
            inputSchema: {
              type: "object",
              properties: {
                model_class: {
                  type: "string",
                  description: "Model class for form generation",
                },
                form_name: {
                  type: "string",
                  description: "Form class name",
                },
                include_fields: {
                  type: "array",
                  items: { type: "string" },
                  description: "Fields to include in form",
                },
                exclude_fields: {
                  type: "array",
                  items: { type: "string" },
                  description: "Fields to exclude from form",
                },
                enable_ajax_validation: {
                  type: "boolean",
                  description: "Enable AJAX validation",
                  default: true,
                },
              },
              required: ["model_class"],
            },
          },

          // Cache Management Tools  
          {
            name: "cache_clear",
            description: "Clear specific cache types or all caches",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "Cache type to clear",
                  enum: ["all", "data", "schema", "template", "assets", "opcache"],
                  default: "all",
                },
                tags: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific cache tags to clear",
                },
              },
              required: [],
            },
          },
          {
            name: "cache_inspect",
            description: "View cache contents and statistics",
            inputSchema: {
              type: "object",
              properties: {
                key: {
                  type: "string",
                  description: "Specific cache key to inspect",
                },
                component: {
                  type: "string",
                  description: "Cache component to inspect",
                  default: "cache",
                },
                show_content: {
                  type: "boolean",
                  description: "Show cache content (may be large)",
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: "cache_performance",
            description: "Analyze cache hit/miss statistics and performance",
            inputSchema: {
              type: "object",
              properties: {
                period: {
                  type: "string",
                  description: "Analysis period",
                  enum: ["1h", "24h", "7d", "30d"],
                  default: "24h",
                },
                component: {
                  type: "string",
                  description: "Cache component to analyze",
                },
              },
              required: [],
            },
          },

          // RBAC Deep Analysis Tools
          {
            name: "rbac_permission_tree",
            description: "Visualize RBAC permission hierarchy and inheritance",
            inputSchema: {
              type: "object",
              properties: {
                root_item: {
                  type: "string",
                  description: "Root permission/role to start tree from",
                },
                max_depth: {
                  type: "number",
                  description: "Maximum depth to traverse",
                  default: 5,
                },
                include_permissions: {
                  type: "boolean",
                  description: "Include permission details",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "rbac_user_access",
            description: "Check what a specific user can access",
            inputSchema: {
              type: "object",
              properties: {
                user_id: {
                  type: "string",
                  description: "User ID to check access for",
                },
                route: {
                  type: "string", 
                  description: "Specific route to check (optional)",
                },
                params: {
                  type: "object",
                  description: "Additional parameters for access check",
                },
              },
              required: ["user_id"],
            },
          },
          {
            name: "rbac_role_analysis",
            description: "Analyze role assignments and detect conflicts",
            inputSchema: {
              type: "object",
              properties: {
                role_name: {
                  type: "string",
                  description: "Specific role to analyze",
                },
                check_conflicts: {
                  type: "boolean",
                  description: "Check for permission conflicts",
                  default: true,
                },
                include_users: {
                  type: "boolean",
                  description: "Include users assigned to roles",
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: "rbac_access_debug",
            description: "Debug why access is denied for a user/route combination",
            inputSchema: {
              type: "object",
              properties: {
                user_id: {
                  type: "string",
                  description: "User ID having access issues",
                },
                route: {
                  type: "string",
                  description: "Route that's being denied",
                },
                params: {
                  type: "object",
                  description: "Route parameters",
                },
                verbose: {
                  type: "boolean",
                  description: "Show detailed debugging information",
                  default: true,
                },
              },
              required: ["user_id", "route"],
            },
          },

          // Queue Management Tools
          {
            name: "queue_job_status",
            description: "Monitor running, waiting, and failed queue jobs",
            inputSchema: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  description: "Filter by job status",
                  enum: ["all", "waiting", "reserved", "done", "failed"],
                  default: "all",
                },
                job_class: {
                  type: "string",
                  description: "Filter by specific job class",
                },
                limit: {
                  type: "number",
                  description: "Limit number of results",
                  default: 50,
                },
              },
              required: [],
            },
          },
          {
            name: "queue_retry_failed",
            description: "Retry specific failed jobs",
            inputSchema: {
              type: "object",
              properties: {
                job_id: {
                  type: "string",
                  description: "Specific job ID to retry",
                },
                job_class: {
                  type: "string",
                  description: "Retry all failed jobs of this class",
                },
                max_age: {
                  type: "string",
                  description: "Only retry jobs failed within this time (e.g., '1h', '1d')",
                },
                dry_run: {
                  type: "boolean",
                  description: "Preview jobs that would be retried",
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: "queue_worker_status",
            description: "Check queue worker health and performance",
            inputSchema: {
              type: "object",
              properties: {
                worker_id: {
                  type: "string",
                  description: "Specific worker ID to check",
                },
                include_metrics: {
                  type: "boolean",
                  description: "Include performance metrics",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "queue_clear_failed",
            description: "Clean up failed jobs from queue",
            inputSchema: {
              type: "object",
              properties: {
                older_than: {
                  type: "string",
                  description: "Clear jobs older than this period (e.g., '7d', '30d')",
                  default: "7d",
                },
                job_class: {
                  type: "string",
                  description: "Only clear jobs of this class",
                },
                dry_run: {
                  type: "boolean",
                  description: "Preview jobs that would be cleared",
                  default: true,
                },
              },
              required: [],
            },
          },

          // Log Analysis & Debugging Tools
          {
            name: "log_error_analysis",
            description: "Parse and categorize application errors from logs",
            inputSchema: {
              type: "object",
              properties: {
                log_file: {
                  type: "string",
                  description: "Specific log file to analyze (optional)",
                },
                time_range: {
                  type: "string",
                  description: "Time range for analysis (e.g., '1h', '24h', '7d')",
                  default: "24h",
                },
                error_level: {
                  type: "string",
                  description: "Minimum error level",
                  enum: ["emergency", "alert", "critical", "error", "warning", "notice", "info", "debug"],
                  default: "error",
                },
                group_by: {
                  type: "string",
                  description: "Group errors by category",
                  enum: ["type", "file", "message", "frequency"],
                  default: "frequency",
                },
              },
              required: [],
            },
          },
          {
            name: "log_performance_issues",
            description: "Find slow queries and performance bottlenecks in logs",
            inputSchema: {
              type: "object",
              properties: {
                threshold_ms: {
                  type: "number",
                  description: "Minimum execution time threshold in milliseconds",
                  default: 1000,
                },
                time_range: {
                  type: "string",
                  description: "Time range for analysis",
                  default: "24h",
                },
                include_queries: {
                  type: "boolean",
                  description: "Include slow database queries",
                  default: true,
                },
                include_requests: {
                  type: "boolean",
                  description: "Include slow HTTP requests",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "log_search",
            description: "Search logs with advanced filters and patterns",
            inputSchema: {
              type: "object",
              properties: {
                pattern: {
                  type: "string",
                  description: "Search pattern (regex supported)",
                },
                log_file: {
                  type: "string",
                  description: "Specific log file to search",
                },
                time_range: {
                  type: "string",
                  description: "Time range for search",
                  default: "24h",
                },
                level: {
                  type: "string",
                  description: "Log level filter",
                },
                context_lines: {
                  type: "number",
                  description: "Number of context lines to show around matches",
                  default: 3,
                },
                limit: {
                  type: "number",
                  description: "Maximum number of results",
                  default: 100,
                },
              },
              required: ["pattern"],
            },
          },
          {
            name: "log_tail",
            description: "Real-time log monitoring and streaming",
            inputSchema: {
              type: "object",
              properties: {
                log_file: {
                  type: "string",
                  description: "Specific log file to tail",
                },
                lines: {
                  type: "number",
                  description: "Number of recent lines to show initially",
                  default: 50,
                },
                filter: {
                  type: "string",
                  description: "Filter pattern for log entries",
                },
                level: {
                  type: "string",
                  description: "Minimum log level to show",
                },
              },
              required: [],
            },
          },

          // Database Optimization Tools
          {
            name: "db_index_suggestions",
            description: "Analyze queries and suggest missing database indexes",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string",
                  description: "Specific table to analyze",
                },
                analyze_slow_queries: {
                  type: "boolean",
                  description: "Analyze slow query log for index suggestions",
                  default: true,
                },
                min_query_time: {
                  type: "number",
                  description: "Minimum query time threshold for analysis",
                  default: 1.0,
                },
              },
              required: [],
            },
          },
          {
            name: "db_query_profiler",
            description: "Profile and analyze database query performance",
            inputSchema: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Specific query to profile",
                },
                explain_plan: {
                  type: "boolean",
                  description: "Include query execution plan",
                  default: true,
                },
                analyze_structure: {
                  type: "boolean",
                  description: "Analyze query structure and suggest optimizations",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "db_table_analysis",
            description: "Analyze table size, fragmentation, and optimization opportunities",
            inputSchema: {
              type: "object",
              properties: {
                table_name: {
                  type: "string",
                  description: "Specific table to analyze",
                },
                include_indexes: {
                  type: "boolean",
                  description: "Include index analysis",
                  default: true,
                },
                check_fragmentation: {
                  type: "boolean",
                  description: "Check table fragmentation",
                  default: true,
                },
              },
              required: [],
            },
          },

          // Testing Support Tools
          {
            name: "test_run",
            description: "Run specific test suites or individual tests",
            inputSchema: {
              type: "object",
              properties: {
                test_suite: {
                  type: "string",
                  description: "Test suite to run (unit, functional, acceptance)",
                },
                test_class: {
                  type: "string",
                  description: "Specific test class to run",
                },
                test_method: {
                  type: "string",
                  description: "Specific test method to run",
                },
                coverage: {
                  type: "boolean",
                  description: "Generate code coverage report",
                  default: false,
                },
                verbose: {
                  type: "boolean",
                  description: "Verbose output",
                  default: false,
                },
              },
              required: [],
            },
          },
          {
            name: "test_generate",
            description: "Generate test scaffolds for models, controllers, or components",
            inputSchema: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  description: "Type of test to generate",
                  enum: ["unit", "functional", "acceptance"],
                },
                target_class: {
                  type: "string",
                  description: "Class to generate tests for",
                },
                include_fixtures: {
                  type: "boolean",
                  description: "Generate test fixtures",
                  default: true,
                },
                test_methods: {
                  type: "array",
                  items: { type: "string" },
                  description: "Specific methods to test",
                },
              },
              required: ["type", "target_class"],
            },
          },
          {
            name: "test_coverage_report",
            description: "Generate and analyze code coverage reports",
            inputSchema: {
              type: "object",
              properties: {
                format: {
                  type: "string",
                  description: "Coverage report format",
                  enum: ["html", "text", "xml", "json"],
                  default: "text",
                },
                filter_path: {
                  type: "string",
                  description: "Filter coverage by path pattern",
                },
                min_coverage: {
                  type: "number",
                  description: "Minimum coverage percentage threshold",
                  default: 80,
                },
              },
              required: [],
            },
          },

          // Performance Monitoring Tools
          {
            name: "performance_profile",
            description: "Analyze application memory and CPU usage patterns",
            inputSchema: {
              type: "object",
              properties: {
                duration: {
                  type: "string",
                  description: "Profiling duration (e.g., '30s', '5m')",
                  default: "30s",
                },
                include_memory: {
                  type: "boolean",
                  description: "Include memory usage analysis",
                  default: true,
                },
                include_cpu: {
                  type: "boolean",
                  description: "Include CPU usage analysis",
                  default: true,
                },
                sample_rate: {
                  type: "number",
                  description: "Sampling rate for profiling",
                  default: 100,
                },
              },
              required: [],
            },
          },
          {
            name: "asset_performance_analysis",
            description: "Analyze frontend asset loading performance",
            inputSchema: {
              type: "object",
              properties: {
                page_url: {
                  type: "string",
                  description: "Specific page URL to analyze",
                },
                include_compression: {
                  type: "boolean",
                  description: "Analyze asset compression opportunities",
                  default: true,
                },
                check_caching: {
                  type: "boolean",
                  description: "Check browser caching headers",
                  default: true,
                },
              },
              required: [],
            },
          },
          {
            name: "db_connection_monitor",
            description: "Monitor database connection pool and performance",
            inputSchema: {
              type: "object",
              properties: {
                duration: {
                  type: "string",
                  description: "Monitoring duration",
                  default: "5m",
                },
                alert_threshold: {
                  type: "number",
                  description: "Connection count threshold for alerts",
                  default: 80,
                },
                include_slow_queries: {
                  type: "boolean",
                  description: "Include slow query analysis",
                  default: true,
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
            return await this.dbManager.describeTable(args?.table_name as string);

          case "db_table_relationships":
            return await this.dbManager.getTableRelationships(args?.table_name as string);

          case "db_execute_query":
            return await this.dbManager.executeQuery(args?.query as string, (args?.limit as number) || 100);

          // Yii2 Tools
          case "yii_list_commands":
            return await this.yii2Manager.listCommands();

          case "yii_command_help":
            return await this.yii2Manager.getCommandHelp(args?.command as string);

          case "yii_execute_command":
            return await this.yii2Manager.executeCommand(
              args?.command as string,
              (args?.args as string[]) || [],
              (args?.interactive as boolean) || false
            );

          case "yii_list_migrations":
            return await this.yii2Manager.listMigrations();

          case "yii_list_models":
            return await this.yii2Manager.listModels(args?.module as string | undefined);

          case "yii_analyze_model":
            return await this.yii2Manager.analyzeModel(args?.model_class as string);

          // Project Tools
          case "project_structure":
            return await this.yii2Manager.getProjectStructure();

          case "module_info":
            return await this.yii2Manager.getModuleInfo(args?.module_name as string);

          case "config_inspect":
            return await this.yii2Manager.inspectConfig(args?.config_type as 'web' | 'console' | 'db' | 'params');

          // Advanced Module Tools
          case "module_detailed_analysis":
            return await this.yii2Manager.getDetailedModuleInfo(args?.module_name as string);

          // Asset Management Tools
          case "asset_list_bundles":
            return await this.yii2Manager.listAssetBundles(args?.module_filter as string | undefined);

          case "asset_analyze_dependencies":
            return await this.yii2Manager.analyzeAssetDependencies(args?.asset_name as string | undefined);

          // Widget Discovery Tools
          case "widget_list":
            return await this.yii2Manager.listWidgets(args?.module_filter as string | undefined);

          // Migration Management Tools
          case "migration_create":
            return await this.yii2Manager.createMigration(
              args?.name as string, 
              args?.template as string, 
              args?.table_name as string,
              args?.options as any
            );

          case "migration_diff":
            return await this.yii2Manager.getMigrationDiff(args?.detailed as boolean);

          case "migration_rollback":
            return await this.yii2Manager.rollbackMigration(
              args?.steps as number, 
              args?.dry_run as boolean
            );

          case "migration_generate_from_model":
            return await this.yii2Manager.generateMigrationFromModel(
              args?.model_class as string,
              args?.compare_with_table as boolean
            );

          // Code Generation Tools
          case "generate_crud":
            return await this.yii2Manager.generateCrud({
              model_class: args?.model_class as string,
              controller_id: args?.controller_id as string,
              module: args?.module as string,
              base_controller_class: args?.base_controller_class as string,
              enable_i18n: args?.enable_i18n as boolean
            });

          case "generate_model":
            return await this.yii2Manager.generateModel({
              table_name: args?.table_name as string,
              model_class: args?.model_class as string,
              namespace: args?.namespace as string,
              base_class: args?.base_class as string,
              generate_relations: args?.generate_relations as boolean,
              generate_labels: args?.generate_labels as boolean
            });

          case "generate_api":
            return await this.yii2Manager.generateApi({
              model_class: args?.model_class as string,
              api_version: args?.api_version as string,
              base_url: args?.base_url as string,
              enable_auth: args?.enable_auth as boolean,
              serializer_fields: args?.serializer_fields as string[]
            });

          case "generate_form":
            return await this.yii2Manager.generateForm({
              model_class: args?.model_class as string,
              form_name: args?.form_name as string,
              include_fields: args?.include_fields as string[],
              exclude_fields: args?.exclude_fields as string[],
              enable_ajax_validation: args?.enable_ajax_validation as boolean
            });

          // Cache Management Tools
          case "cache_clear":
            return await this.yii2Manager.clearCache(
              args?.type as string,
              args?.tags as string[]
            );

          case "cache_inspect":
            return await this.yii2Manager.inspectCache(
              args?.key as string,
              args?.component as string,
              args?.show_content as boolean
            );

          case "cache_performance":
            return await this.yii2Manager.analyzeCachePerformance(
              args?.period as string,
              args?.component as string
            );

          // RBAC Deep Analysis Tools
          case "rbac_permission_tree":
            return await this.yii2Manager.getRbacPermissionTree(
              args?.root_item as string,
              args?.max_depth as number,
              args?.include_permissions as boolean
            );

          case "rbac_user_access":
            return await this.yii2Manager.checkUserAccess(
              args?.user_id as string,
              args?.route as string,
              args?.params as any
            );

          case "rbac_role_analysis":
            return await this.yii2Manager.analyzeRbacRoles(
              args?.role_name as string,
              args?.check_conflicts as boolean,
              args?.include_users as boolean
            );

          case "rbac_access_debug":
            return await this.yii2Manager.debugRbacAccess(
              args?.user_id as string,
              args?.route as string,
              args?.params as any,
              args?.verbose as boolean
            );

          // Queue Management Tools
          case "queue_job_status":
            return await this.yii2Manager.getQueueJobStatus(
              args?.status as string,
              args?.job_class as string,
              args?.limit as number
            );

          case "queue_retry_failed":
            return await this.yii2Manager.retryFailedJobs(
              args?.job_id as string,
              args?.job_class as string,
              args?.max_age as string,
              args?.dry_run as boolean
            );

          case "queue_worker_status":
            return await this.yii2Manager.getQueueWorkerStatus(
              args?.worker_id as string,
              args?.include_metrics as boolean
            );

          case "queue_clear_failed":
            return await this.yii2Manager.clearFailedJobs(
              args?.older_than as string,
              args?.job_class as string,
              args?.dry_run as boolean
            );

          // Log Analysis & Debugging Tools  
          case "log_error_analysis":
            return await this.yii2Manager.analyzeLogErrors(
              args?.log_file as string,
              args?.time_range as string,
              args?.error_level as string,
              args?.group_by as string
            );

          case "log_performance_issues":
            return await this.yii2Manager.findPerformanceIssues(
              args?.threshold_ms as number,
              args?.time_range as string,
              args?.include_queries as boolean,
              args?.include_requests as boolean
            );

          case "log_search":
            return await this.yii2Manager.searchLogs(
              args?.pattern as string,
              args?.log_file as string,
              args?.time_range as string,
              args?.level as string,
              args?.context_lines as number,
              args?.limit as number
            );

          case "log_tail":
            return await this.yii2Manager.tailLogs(
              args?.log_file as string,
              args?.lines as number,
              args?.filter as string,
              args?.level as string
            );

          // Database Optimization Tools
          case "db_index_suggestions":
            return await this.dbManager.getIndexSuggestions(
              args?.table_name as string,
              args?.analyze_slow_queries as boolean,
              args?.min_query_time as number
            );

          case "db_query_profiler":
            return await this.dbManager.profileQuery(
              args?.query as string,
              args?.explain_plan as boolean,
              args?.analyze_structure as boolean
            );

          case "db_table_analysis":
            return await this.dbManager.analyzeTable(
              args?.table_name as string,
              args?.include_indexes as boolean,
              args?.check_fragmentation as boolean
            );

          // Testing Support Tools
          case "test_run":
            return await this.yii2Manager.runTests(
              args?.test_suite as string,
              args?.test_class as string,
              args?.test_method as string,
              args?.coverage as boolean,
              args?.verbose as boolean
            );

          case "test_generate":
            return await this.yii2Manager.generateTests(
              args?.type as string,
              args?.target_class as string,
              args?.include_fixtures as boolean,
              args?.test_methods as string[]
            );

          case "test_coverage_report":
            return await this.yii2Manager.generateCoverageReport(
              args?.format as string,
              args?.filter_path as string,
              args?.min_coverage as number
            );

          // Performance Monitoring Tools
          case "performance_profile":
            return await this.yii2Manager.profilePerformance(
              args?.duration as string,
              args?.include_memory as boolean,
              args?.include_cpu as boolean,
              args?.sample_rate as number
            );

          case "asset_performance_analysis":
            return await this.yii2Manager.analyzeAssetPerformance(
              args?.page_url as string,
              args?.include_compression as boolean,
              args?.check_caching as boolean
            );

          case "db_connection_monitor":
            return await this.dbManager.monitorConnections(
              args?.duration as string,
              args?.alert_threshold as number,
              args?.include_slow_queries as boolean
            );

          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
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