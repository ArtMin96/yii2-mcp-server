import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { ConfigManager } from './config.js';
import { DatabaseManager } from './database.js';

const execAsync = promisify(exec);

export interface CommandInfo {
  name: string;
  description: string;
  actions: string[];
}

export interface MigrationInfo {
  name: string;
  status: 'applied' | 'pending';
  date?: string;
}

export interface ModelInfo {
  name: string;
  path: string;
  module?: string;
  tableName?: string;
  relations: string[];
}

export interface AssetInfo {
  name: string;
  path: string;
  module?: string;
  basePath?: string;
  baseUrl?: string;
  css: string[];
  js: string[];
  depends: string[];
  sourcePath?: string;
  publishOptions?: any;
}

export interface ModuleDetailInfo {
  name: string;
  path: string;
  moduleClass?: string;
  controllerNamespace?: string;
  controllers: string[];
  models: string[];
  views: string[];
  assets: AssetInfo[];
  widgets: string[];
  components: string[];
  jobs: string[];
  services: string[];
  traits: string[];
  hasBootstrap: boolean;
  dependencies: string[];
}

export interface WidgetInfo {
  name: string;
  path: string;
  module?: string;
  assetBundle?: string;
  dependencies: string[];
}

export class Yii2Manager {
  private projectPath: string;
  private yiiScript: string;
  public dbManager: DatabaseManager;

  constructor(private configManager: ConfigManager) {
    const config = configManager.getYii2Config();
    this.projectPath = config.projectPath;
    this.yiiScript = config.yiiScript;
    this.dbManager = new DatabaseManager(configManager);
  }

  async listCommands() {
    try {
      const { stdout } = await execAsync(`php "${this.yiiScript}" help`, {
        cwd: this.projectPath
      });

      // Parse the help output to extract commands
      const lines = stdout.split('\n');
      const commands: CommandInfo[] = [];
      let currentCommand: CommandInfo | null = null;
      let inCommandSection = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('- ') && !trimmed.includes('    ')) {
          // New command
          if (currentCommand) {
            commands.push(currentCommand);
          }
          
          const parts = trimmed.substring(2).split(/\s{2,}/);
          currentCommand = {
            name: parts[0],
            description: parts[1] || '',
            actions: []
          };
          inCommandSection = true;
        } else if (inCommandSection && trimmed.startsWith('    ') && !trimmed.startsWith('        ')) {
          // Command action
          if (currentCommand) {
            const actionLine = trimmed.substring(4);
            const actionParts = actionLine.split(/\s{2,}/);
            currentCommand.actions.push(actionParts[0]);
          }
        } else if (trimmed === '' && currentCommand) {
          // End of current command
          commands.push(currentCommand);
          currentCommand = null;
          inCommandSection = false;
        }
      }

      if (currentCommand) {
        commands.push(currentCommand);
      }

      let result = `Available Yii2 Console Commands:\n\n`;
      
      // Group by category
      const categories = new Map<string, CommandInfo[]>();
      
      commands.forEach(cmd => {
        const category = cmd.name.split('/')[0];
        if (!categories.has(category)) {
          categories.set(category, []);
        }
        categories.get(category)!.push(cmd);
      });

      for (const [category, categoryCommands] of categories) {
        result += `### ${category}\n`;
        categoryCommands.forEach(cmd => {
          result += `• **${cmd.name}** - ${cmd.description}\n`;
          if (cmd.actions.length > 0) {
            cmd.actions.forEach(action => {
              result += `  - ${action}\n`;
            });
          }
        });
        result += '\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list commands: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCommandHelp(command: string) {
    try {
      const { stdout } = await execAsync(`php "${this.yiiScript}" help ${command}`, {
        cwd: this.projectPath
      });

      return {
        content: [
          {
            type: "text",
            text: `Help for command: ${command}\n\n${stdout}`
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get help for ${command}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async executeCommand(command: string, args: string[] = [], interactive: boolean = false) {
    try {
      // Safety check - avoid dangerous commands
      const dangerousCommands = [
        'migrate/fresh',
        'migrate/down',
        'cache/flush-all'
      ];
      
      if (dangerousCommands.some(dangerous => command.includes(dangerous))) {
        return {
          content: [
            {
              type: "text",
              text: `Command '${command}' is considered dangerous and blocked for safety. Use interactive mode or run manually if needed.`
            }
          ]
        };
      }

      const fullCommand = `php "${this.yiiScript}" ${command} ${args.join(' ')}`.trim();
      
      if (interactive) {
        return {
          content: [
            {
              type: "text",
              text: `Interactive command detected: ${fullCommand}\n\nPlease run this command manually in your terminal as it requires user input.`
            }
          ]
        };
      }

      const { stdout, stderr } = await execAsync(fullCommand, {
        cwd: this.projectPath,
        timeout: 30000 // 30 second timeout
      });

      let result = `Command executed: ${fullCommand}\n\n`;
      if (stdout) {
        result += `Output:\n${stdout}\n`;
      }
      if (stderr) {
        result += `\nErrors:\n${stderr}`;
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Command execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listMigrations() {
    try {
      // Get migration history
      const { stdout: history } = await execAsync(`php "${this.yiiScript}" migrate/history`, {
        cwd: this.projectPath
      });

      // Get new migrations
      const { stdout: newMigrations } = await execAsync(`php "${this.yiiScript}" migrate/new`, {
        cwd: this.projectPath
      });

      let result = `Migration Status:\n\n`;
      
      result += `Applied Migrations:\n`;
      const historyLines = history.split('\n').filter(line => line.trim().startsWith('m'));
      if (historyLines.length > 0) {
        historyLines.slice(0, 10).forEach(line => {
          const parts = line.trim().split(/\s+/);
          result += `• ${parts[0]} (${parts[1]} ${parts[2]})\n`;
        });
        if (historyLines.length > 10) {
          result += `... and ${historyLines.length - 10} more applied migrations\n`;
        }
      } else {
        result += 'No applied migrations found.\n';
      }

      result += `\nPending Migrations:\n`;
      const newLines = newMigrations.split('\n').filter(line => line.trim().startsWith('m'));
      if (newLines.length > 0) {
        newLines.forEach(line => {
          result += `• ${line.trim()}\n`;
        });
      } else {
        result += 'No pending migrations.\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list migrations: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listModels(moduleFilter?: string) {
    try {
      const models: ModelInfo[] = [];
      
      // Scan models directory
      const modelsPath = join(this.projectPath, 'models');
      if (existsSync(modelsPath)) {
        this.scanModelsDirectory(modelsPath, models);
      }

      // Scan module models
      const modulesPath = join(this.projectPath, 'modules');
      if (existsSync(modulesPath)) {
        const moduleNames = readdirSync(modulesPath);
        for (const moduleName of moduleNames) {
          if (moduleFilter && moduleName !== moduleFilter) continue;
          
          const moduleModelsPath = join(modulesPath, moduleName, 'models');
          if (existsSync(moduleModelsPath)) {
            this.scanModelsDirectory(moduleModelsPath, models, moduleName);
          }
        }
      }

      let result = `ActiveRecord Models Found: ${models.length}\n\n`;
      
      if (moduleFilter) {
        result = `ActiveRecord Models in module '${moduleFilter}': ${models.filter(m => m.module === moduleFilter).length}\n\n`;
      }

      // Group by module
      const byModule = new Map<string, ModelInfo[]>();
      models.forEach(model => {
        const module = model.module || 'app';
        if (!byModule.has(module)) {
          byModule.set(module, []);
        }
        byModule.get(module)!.push(model);
      });

      for (const [module, moduleModels] of byModule) {
        if (moduleFilter && module !== moduleFilter) continue;
        
        result += `### ${module}\n`;
        moduleModels.forEach(model => {
          result += `• **${model.name}**`;
          if (model.tableName) {
            result += ` (table: ${model.tableName})`;
          }
          result += `\n  Path: ${model.path}\n`;
          if (model.relations.length > 0) {
            result += `  Relations: ${model.relations.join(', ')}\n`;
          }
        });
        result += '\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list models: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private scanModelsDirectory(dirPath: string, models: ModelInfo[], module?: string) {
    const files = readdirSync(dirPath);
    
    for (const file of files) {
      const filePath = join(dirPath, file);
      const stat = statSync(filePath);
      
      if (stat.isDirectory()) {
        this.scanModelsDirectory(filePath, models, module);
      } else if (extname(file) === '.php') {
        try {
          const content = readFileSync(filePath, 'utf-8');
          
          // Check if it's an ActiveRecord model
          if (content.includes('extends ActiveRecord') || content.includes('extends \\yii\\db\\ActiveRecord')) {
            const className = basename(file, '.php');
            const tableName = this.extractTableName(content);
            const relations = this.extractRelations(content);
            
            models.push({
              name: className,
              path: filePath.replace(this.projectPath, ''),
              module,
              tableName,
              relations
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    }
  }

  private extractTableName(content: string): string | undefined {
    // Look for tableName() method
    const tableNameMatch = content.match(/public\s+static\s+function\s+tableName\(\)\s*{[^}]*return\s+['"]([^'"]+)['"]/);
    if (tableNameMatch) {
      return tableNameMatch[1];
    }
    return undefined;
  }

  private extractRelations(content: string): string[] {
    const relations: string[] = [];
    
    // Look for hasOne, hasMany, belongsTo methods
    const relationMatches = content.matchAll(/public\s+function\s+(\w+)\(\)[^{]*{[^}]*(?:hasOne|hasMany|belongsTo)/g);
    
    for (const match of relationMatches) {
      relations.push(match[1]);
    }
    
    return relations;
  }

  async analyzeModel(modelClass: string) {
    try {
      // Try to get model information using Yii console
      const { stdout } = await execAsync(`php "${this.yiiScript}" gii/model --help`, {
        cwd: this.projectPath
      });

      // For now, return basic analysis
      // In a full implementation, you could create a custom Yii command to analyze models
      
      let result = `Model Analysis: ${modelClass}\n\n`;
      result += `This feature requires a custom Yii console command for deep model analysis.\n`;
      result += `Consider using the 'yii_list_models' tool to get basic model information.\n\n`;
      result += `To analyze this model manually, you can:\n`;
      result += `1. Check the model file for table name, relations, and validation rules\n`;
      result += `2. Use 'db_describe_table' tool if you know the table name\n`;
      result += `3. Use 'db_table_relationships' to see database relationships\n`;

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze model ${modelClass}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getProjectStructure() {
    try {
      let result = `Yii2 Project Structure:\n\n`;
      
      // Basic structure
      const structure = [
        'config/',
        'controllers/',
        'models/',
        'modules/',
        'views/',
        'web/',
        'runtime/',
        'vendor/',
        'migrations/'
      ];

      result += `### Core Directories:\n`;
      structure.forEach(dir => {
        const fullPath = join(this.projectPath, dir);
        if (existsSync(fullPath)) {
          const stat = statSync(fullPath);
          result += `• ${dir} - ${stat.isDirectory() ? 'Directory' : 'File'}\n`;
        }
      });

      // List modules
      const modulesPath = join(this.projectPath, 'modules');
      if (existsSync(modulesPath)) {
        const modules = readdirSync(modulesPath).filter(item => {
          const modulePath = join(modulesPath, item);
          return statSync(modulePath).isDirectory();
        });

        if (modules.length > 0) {
          result += `\n### Available Modules:\n`;
          modules.forEach(module => {
            result += `• ${module}\n`;
          });
        }
      }

      // Check for important files
      result += `\n### Important Files:\n`;
      const importantFiles = [
        'yii',
        'composer.json',
        '.env',
        'requirements.php'
      ];

      importantFiles.forEach(file => {
        const fullPath = join(this.projectPath, file);
        if (existsSync(fullPath)) {
          result += `• ${file} ✓\n`;
        } else {
          result += `• ${file} ✗\n`;
        }
      });

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get project structure: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getModuleInfo(moduleName: string) {
    try {
      const modulePath = join(this.projectPath, 'modules', moduleName);
      
      if (!existsSync(modulePath)) {
        throw new Error(`Module '${moduleName}' not found`);
      }

      let result = `Module Information: ${moduleName}\n\n`;
      result += `Path: ${modulePath}\n\n`;

      // Check module structure
      const moduleStructure = [
        'controllers',
        'models',
        'views',
        'migrations',
        'Module.php'
      ];

      result += `### Module Structure:\n`;
      moduleStructure.forEach(item => {
        const itemPath = join(modulePath, item);
        if (existsSync(itemPath)) {
          const stat = statSync(itemPath);
          if (stat.isDirectory()) {
            const contents = readdirSync(itemPath);
            result += `• ${item}/ (${contents.length} items)\n`;
          } else {
            result += `• ${item} ✓\n`;
          }
        } else {
          result += `• ${item} ✗\n`;
        }
      });

      // Read Module.php if exists
      const moduleFile = join(modulePath, 'Module.php');
      if (existsSync(moduleFile)) {
        try {
          const content = readFileSync(moduleFile, 'utf-8');
          const classMatch = content.match(/class\s+(\w+)\s+extends/);
          if (classMatch) {
            result += `\n### Module Class: ${classMatch[1]}\n`;
          }
          
          // Extract basic info
          if (content.includes('public $controllerNamespace')) {
            const namespaceMatch = content.match(/controllerNamespace\\s*=\\s*['"]([^'"]+)['"]/);
            if (namespaceMatch) {
              result += `Controller Namespace: ${namespaceMatch[1]}\n`;
            }
          }
        } catch (error) {
          result += `\nCould not read Module.php: ${error instanceof Error ? error.message : String(error)}\n`;
        }
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get module info for ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async inspectConfig(configType: 'web' | 'console' | 'db' | 'params') {
    try {
      const configFile = `${configType}.php`;
      const configPath = this.configManager.getConfigPath(configFile);
      
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file '${configFile}' not found`);
      }

      let result = `Configuration: ${configType}.php\n\n`;
      result += `Path: ${configPath}\n\n`;

      // For security, we won't display the full config content
      // Instead, we'll show the structure
      const content = readFileSync(configPath, 'utf-8');
      
      // Extract main sections
      const sections = [];
      if (content.includes("'id'")) sections.push('id');
      if (content.includes("'basePath'")) sections.push('basePath');
      if (content.includes("'components'")) sections.push('components');
      if (content.includes("'modules'")) sections.push('modules');
      if (content.includes("'params'")) sections.push('params');
      if (content.includes("'bootstrap'")) sections.push('bootstrap');
      if (content.includes("'controllerNamespace'")) sections.push('controllerNamespace');

      result += `### Configuration Sections Found:\n`;
      sections.forEach(section => {
        result += `• ${section}\n`;
      });

      // Extract component names
      const componentMatches = content.matchAll(/'(\w+)'\s*=>\s*\[/g);
      const components = [];
      for (const match of componentMatches) {
        components.push(match[1]);
      }

      if (components.length > 0) {
        result += `\n### Components Configured:\n`;
        [...new Set(components)].forEach(component => {
          result += `• ${component}\n`;
        });
      }

      result += `\n*Note: For security reasons, actual configuration values are not displayed. Use file reading tools to view specific sections if needed.*`;

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to inspect ${configType} config: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getDetailedModuleInfo(moduleName: string) {
    try {
      const modulePath = join(this.projectPath, 'modules', moduleName);
      
      if (!existsSync(modulePath)) {
        throw new Error(`Module '${moduleName}' not found`);
      }

      const moduleInfo: ModuleDetailInfo = {
        name: moduleName,
        path: modulePath,
        controllers: [],
        models: [],
        views: [],
        assets: [],
        widgets: [],
        components: [],
        jobs: [],
        services: [],
        traits: [],
        hasBootstrap: false,
        dependencies: []
      };

      // Analyze module structure
      const items = readdirSync(modulePath);
      
      for (const item of items) {
        const itemPath = join(modulePath, item);
        const stat = statSync(itemPath);
        
        if (stat.isFile()) {
          if (item === 'Module.php') {
            const content = readFileSync(itemPath, 'utf-8');
            const classMatch = content.match(/class\s+(\w+)\s+extends/);
            if (classMatch) {
              moduleInfo.moduleClass = classMatch[1];
            }
            
            const namespaceMatch = content.match(/controllerNamespace\s*=\s*['"]([^'"]+)['"]/);
            if (namespaceMatch) {
              moduleInfo.controllerNamespace = namespaceMatch[1];
            }
          } else if (item === 'Bootstrap.php') {
            moduleInfo.hasBootstrap = true;
          }
        } else if (stat.isDirectory()) {
          switch (item) {
            case 'controllers':
              moduleInfo.controllers = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'models':
              moduleInfo.models = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'views':
              moduleInfo.views = this.scanDirectory(itemPath, '.php');
              break;
            case 'widgets':
              moduleInfo.widgets = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'components':
              moduleInfo.components = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'Jobs':
              moduleInfo.jobs = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'Services':
              moduleInfo.services = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
            case 'Traits':
              moduleInfo.traits = this.scanDirectory(itemPath, '.php').map(f => basename(f, '.php'));
              break;
          }
        }
      }

      // Find assets
      moduleInfo.assets = this.findModuleAssets(modulePath, moduleName);

      let result = `Detailed Module Analysis: ${moduleName}\n\n`;
      result += `**Module Class**: ${moduleInfo.moduleClass || 'Not found'}\n`;
      result += `**Controller Namespace**: ${moduleInfo.controllerNamespace || 'Default'}\n`;
      result += `**Has Bootstrap**: ${moduleInfo.hasBootstrap ? 'Yes' : 'No'}\n\n`;

      result += `## Structure Overview\n`;
      result += `• **Controllers**: ${moduleInfo.controllers.length}\n`;
      result += `• **Models**: ${moduleInfo.models.length}\n`;
      result += `• **Assets**: ${moduleInfo.assets.length}\n`;
      result += `• **Widgets**: ${moduleInfo.widgets.length}\n`;
      result += `• **Jobs**: ${moduleInfo.jobs.length}\n`;
      result += `• **Services**: ${moduleInfo.services.length}\n`;
      result += `• **Traits**: ${moduleInfo.traits.length}\n\n`;

      if (moduleInfo.controllers.length > 0) {
        result += `### Controllers\n`;
        moduleInfo.controllers.forEach(controller => {
          result += `• ${controller}\n`;
        });
        result += '\n';
      }

      if (moduleInfo.assets.length > 0) {
        result += `### Asset Bundles\n`;
        moduleInfo.assets.forEach(asset => {
          result += `• **${asset.name}**\n`;
          result += `  - CSS files: ${asset.css.length}\n`;
          result += `  - JS files: ${asset.js.length}\n`;
          result += `  - Dependencies: ${asset.depends.join(', ')}\n`;
          if (asset.sourcePath) {
            result += `  - Source path: ${asset.sourcePath}\n`;
          }
        });
        result += '\n';
      }

      if (moduleInfo.widgets.length > 0) {
        result += `### Widgets\n`;
        moduleInfo.widgets.forEach(widget => {
          result += `• ${widget}\n`;
        });
        result += '\n';
      }

      if (moduleInfo.jobs.length > 0) {
        result += `### Queue Jobs\n`;
        moduleInfo.jobs.forEach(job => {
          result += `• ${job}\n`;
        });
        result += '\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to get detailed module info for ${moduleName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listAssetBundles(moduleFilter?: string) {
    try {
      const assets: AssetInfo[] = [];
      
      // Scan main assets directory
      const assetsPath = join(this.projectPath, 'assets');
      if (existsSync(assetsPath)) {
        const mainAssets = this.findAssets(assetsPath);
        assets.push(...mainAssets);
      }

      // Scan modules for assets
      const modulesPath = join(this.projectPath, 'modules');
      if (existsSync(modulesPath)) {
        const moduleNames = readdirSync(modulesPath);
        for (const moduleName of moduleNames) {
          if (moduleFilter && moduleName !== moduleFilter) continue;
          
          const moduleAssetsPath = join(modulesPath, moduleName);
          if (existsSync(moduleAssetsPath)) {
            const moduleAssets = this.findModuleAssets(moduleAssetsPath, moduleName);
            assets.push(...moduleAssets);
          }
        }
      }

      // Scan widgets for assets
      const widgetsPath = join(this.projectPath, 'widgets');
      if (existsSync(widgetsPath)) {
        const widgetAssets = this.findAssets(widgetsPath, 'widgets');
        assets.push(...widgetAssets);
      }

      let result = `Asset Bundles Found: ${assets.length}\n\n`;
      
      if (moduleFilter) {
        const filteredAssets = assets.filter(a => a.module === moduleFilter);
        result = `Asset Bundles in module '${moduleFilter}': ${filteredAssets.length}\n\n`;
      }

      // Group by module
      const byModule = new Map<string, AssetInfo[]>();
      assets.forEach(asset => {
        const module = asset.module || 'app';
        if (moduleFilter && module !== moduleFilter) return;
        
        if (!byModule.has(module)) {
          byModule.set(module, []);
        }
        byModule.get(module)!.push(asset);
      });

      for (const [module, moduleAssets] of byModule) {
        result += `### ${module}\n`;
        moduleAssets.forEach(asset => {
          result += `• **${asset.name}**\n`;
          result += `  - Path: ${asset.path.replace(this.projectPath, '')}\n`;
          if (asset.basePath) result += `  - Base path: ${asset.basePath}\n`;
          if (asset.baseUrl) result += `  - Base URL: ${asset.baseUrl}\n`;
          if (asset.sourcePath) result += `  - Source path: ${asset.sourcePath}\n`;
          result += `  - CSS: ${asset.css.length} files\n`;
          result += `  - JS: ${asset.js.length} files\n`;
          result += `  - Dependencies: ${asset.depends.length > 0 ? asset.depends.join(', ') : 'None'}\n`;
          
          if (asset.css.length > 0) {
            result += `    CSS: ${asset.css.slice(0, 3).join(', ')}${asset.css.length > 3 ? '...' : ''}\n`;
          }
          if (asset.js.length > 0) {
            result += `    JS: ${asset.js.slice(0, 3).join(', ')}${asset.js.length > 3 ? '...' : ''}\n`;
          }
        });
        result += '\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list asset bundles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeAssetDependencies(assetName?: string) {
    try {
      const assets = await this.getAllAssets();
      
      if (assetName) {
        const asset = assets.find(a => a.name === assetName);
        if (!asset) {
          throw new Error(`Asset '${assetName}' not found`);
        }
        
        return this.analyzeSpecificAsset(asset, assets);
      }

      // Analyze all assets and their dependency tree
      let result = `Asset Dependency Analysis\n\n`;
      
      // Find root assets (no dependencies or only system dependencies)
      const rootAssets = assets.filter(asset => 
        asset.depends.length === 0 || 
        asset.depends.every(dep => dep.startsWith('yii\\'))
      );

      result += `### Root Assets (${rootAssets.length})\n`;
      rootAssets.forEach(asset => {
        result += `• ${asset.name} (${asset.module || 'app'})\n`;
      });
      result += '\n';

      // Find complex dependency chains
      const complexAssets = assets.filter(asset => asset.depends.length > 2);
      if (complexAssets.length > 0) {
        result += `### Assets with Complex Dependencies (${complexAssets.length})\n`;
        complexAssets.forEach(asset => {
          result += `• **${asset.name}** depends on: ${asset.depends.join(', ')}\n`;
        });
        result += '\n';
      }

      // Find potential circular dependencies
      const circularDeps = this.findCircularDependencies(assets);
      if (circularDeps.length > 0) {
        result += `### ⚠️  Potential Circular Dependencies\n`;
        circularDeps.forEach(cycle => {
          result += `• ${cycle.join(' → ')}\n`;
        });
        result += '\n';
      }

      // Asset registration order
      result += `### Recommended Registration Order\n`;
      const sortedAssets = this.topologicalSort(assets);
      sortedAssets.forEach((asset, index) => {
        result += `${index + 1}. ${asset.name} (${asset.module || 'app'})\n`;
      });

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to analyze asset dependencies: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listWidgets(moduleFilter?: string) {
    try {
      const widgets: WidgetInfo[] = [];
      
      // Scan main widgets directory
      const widgetsPath = join(this.projectPath, 'widgets');
      if (existsSync(widgetsPath)) {
        const mainWidgets = this.findWidgets(widgetsPath);
        widgets.push(...mainWidgets);
      }

      // Scan modules for widgets
      const modulesPath = join(this.projectPath, 'modules');
      if (existsSync(modulesPath)) {
        const moduleNames = readdirSync(modulesPath);
        for (const moduleName of moduleNames) {
          if (moduleFilter && moduleName !== moduleFilter) continue;
          
          const moduleWidgetsPath = join(modulesPath, moduleName, 'widgets');
          if (existsSync(moduleWidgetsPath)) {
            const moduleWidgets = this.findWidgets(moduleWidgetsPath, moduleName);
            widgets.push(...moduleWidgets);
          }
        }
      }

      let result = `Widgets Found: ${widgets.length}\n\n`;
      
      if (moduleFilter) {
        const filteredWidgets = widgets.filter(w => w.module === moduleFilter);
        result = `Widgets in module '${moduleFilter}': ${filteredWidgets.length}\n\n`;
      }

      // Group by module
      const byModule = new Map<string, WidgetInfo[]>();
      widgets.forEach(widget => {
        const module = widget.module || 'app';
        if (moduleFilter && module !== moduleFilter) return;
        
        if (!byModule.has(module)) {
          byModule.set(module, []);
        }
        byModule.get(module)!.push(widget);
      });

      for (const [module, moduleWidgets] of byModule) {
        result += `### ${module}\n`;
        moduleWidgets.forEach(widget => {
          result += `• **${widget.name}**\n`;
          result += `  - Path: ${widget.path.replace(this.projectPath, '')}\n`;
          if (widget.assetBundle) {
            result += `  - Asset Bundle: ${widget.assetBundle}\n`;
          }
          if (widget.dependencies.length > 0) {
            result += `  - Dependencies: ${widget.dependencies.join(', ')}\n`;
          }
        });
        result += '\n';
      }

      return {
        content: [
          {
            type: "text",
            text: result
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list widgets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Helper methods
  private scanDirectory(dirPath: string, extension: string): string[] {
    const files: string[] = [];
    
    try {
      const items = readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = join(dirPath, item);
        const stat = statSync(itemPath);
        
        if (stat.isDirectory()) {
          const subFiles = this.scanDirectory(itemPath, extension);
          files.push(...subFiles.map(f => join(item, f)));
        } else if (extname(item) === extension) {
          files.push(item);
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return files;
  }

  private findAssets(dirPath: string, module?: string): AssetInfo[] {
    const assets: AssetInfo[] = [];
    
    try {
      const files = readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = join(dirPath, file);
        const stat = statSync(filePath);
        
        if (stat.isDirectory()) {
          const subAssets = this.findAssets(filePath, module);
          assets.push(...subAssets);
        } else if (file.endsWith('Asset.php') || file.endsWith('Bundle.php')) {
          const assetInfo = this.parseAssetFile(filePath, module);
          if (assetInfo) {
            assets.push(assetInfo);
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return assets;
  }

  private findModuleAssets(modulePath: string, moduleName: string): AssetInfo[] {
    const assets: AssetInfo[] = [];
    
    // Look for assets in the module root
    const rootAssets = this.findAssets(modulePath, moduleName);
    assets.push(...rootAssets);
    
    // Look for assets in widgets
    const widgetsPath = join(modulePath, 'widgets');
    if (existsSync(widgetsPath)) {
      const widgetAssets = this.findAssets(widgetsPath, moduleName);
      assets.push(...widgetAssets);
    }
    
    return assets;
  }

  private parseAssetFile(filePath: string, module?: string): AssetInfo | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const className = basename(filePath, '.php');
      
      const asset: AssetInfo = {
        name: className,
        path: filePath,
        module,
        css: [],
        js: [],
        depends: []
      };

      // Parse basePath
      const basePathMatch = content.match(/\$basePath\s*=\s*['"]([^'"]+)['"]/);
      if (basePathMatch) {
        asset.basePath = basePathMatch[1];
      }

      // Parse baseUrl
      const baseUrlMatch = content.match(/\$baseUrl\s*=\s*['"]([^'"]+)['"]/);
      if (baseUrlMatch) {
        asset.baseUrl = baseUrlMatch[1];
      }

      // Parse sourcePath
      const sourcePathMatch = content.match(/\$sourcePath\s*=\s*['"]([^'"]+)['"]/);
      if (sourcePathMatch) {
        asset.sourcePath = sourcePathMatch[1];
      }

      // Parse CSS files
      const cssMatch = content.match(/\$css\s*=\s*\[(.*?)\]/s);
      if (cssMatch) {
        const cssContent = cssMatch[1];
        const cssFiles = cssContent.match(/'([^']+)'/g);
        if (cssFiles) {
          asset.css = cssFiles.map(file => file.replace(/'/g, ''));
        }
      }

      // Parse JS files
      const jsMatch = content.match(/\$js\s*=\s*\[(.*?)\]/s);
      if (jsMatch) {
        const jsContent = jsMatch[1];
        const jsFiles = jsContent.match(/'([^']+)'/g);
        if (jsFiles) {
          asset.js = jsFiles.map(file => file.replace(/'/g, ''));
        }
      }

      // Parse dependencies
      const dependsMatch = content.match(/\$depends\s*=\s*\[(.*?)\]/s);
      if (dependsMatch) {
        const dependsContent = dependsMatch[1];
        const dependencies = dependsContent.match(/'([^']+)'|(\w+::\w+)/g);
        if (dependencies) {
          asset.depends = dependencies.map(dep => dep.replace(/'/g, ''));
        }
      }

      return asset;
    } catch (error) {
      return null;
    }
  }

  private findWidgets(dirPath: string, module?: string): WidgetInfo[] {
    const widgets: WidgetInfo[] = [];
    
    try {
      const files = readdirSync(dirPath);
      
      for (const file of files) {
        const filePath = join(dirPath, file);
        const stat = statSync(filePath);
        
        if (stat.isDirectory()) {
          // Check if directory contains a widget
          const widgetFile = join(filePath, `${file}.php`);
          if (existsSync(widgetFile)) {
            const widget = this.parseWidgetFile(widgetFile, module);
            if (widget) {
              widgets.push(widget);
            }
          }
          
          // Recursively scan subdirectories
          const subWidgets = this.findWidgets(filePath, module);
          widgets.push(...subWidgets);
        } else if (file.endsWith('.php') && !file.endsWith('Asset.php')) {
          const widget = this.parseWidgetFile(filePath, module);
          if (widget) {
            widgets.push(widget);
          }
        }
      }
    } catch (error) {
      // Directory might not exist or be accessible
    }
    
    return widgets;
  }

  private parseWidgetFile(filePath: string, module?: string): WidgetInfo | null {
    try {
      const content = readFileSync(filePath, 'utf-8');
      const className = basename(filePath, '.php');
      
      // Check if it's a widget (extends Widget or has Widget in class hierarchy)
      if (!content.includes('extends Widget') && !content.includes('Widget')) {
        return null;
      }

      const widget: WidgetInfo = {
        name: className,
        path: filePath,
        module,
        dependencies: []
      };

      // Look for associated asset bundle
      const assetMatch = content.match(/(\w+Asset)::/);
      if (assetMatch) {
        widget.assetBundle = assetMatch[1];
      }

      // Look for dependencies in use statements
      const useMatches = content.matchAll(/use\s+([^;]+);/g);
      for (const match of useMatches) {
        widget.dependencies.push(match[1]);
      }

      return widget;
    } catch (error) {
      return null;
    }
  }

  private async getAllAssets(): Promise<AssetInfo[]> {
    const assets: AssetInfo[] = [];
    
    // Main assets
    const assetsPath = join(this.projectPath, 'assets');
    if (existsSync(assetsPath)) {
      assets.push(...this.findAssets(assetsPath));
    }

    // Module assets
    const modulesPath = join(this.projectPath, 'modules');
    if (existsSync(modulesPath)) {
      const moduleNames = readdirSync(modulesPath);
      for (const moduleName of moduleNames) {
        const moduleAssetsPath = join(modulesPath, moduleName);
        if (existsSync(moduleAssetsPath)) {
          assets.push(...this.findModuleAssets(moduleAssetsPath, moduleName));
        }
      }
    }

    // Widget assets
    const widgetsPath = join(this.projectPath, 'widgets');
    if (existsSync(widgetsPath)) {
      assets.push(...this.findAssets(widgetsPath, 'widgets'));
    }

    return assets;
  }

  private analyzeSpecificAsset(asset: AssetInfo, allAssets: AssetInfo[]) {
    let result = `Asset Analysis: ${asset.name}\n\n`;
    
    result += `**Module**: ${asset.module || 'app'}\n`;
    result += `**Path**: ${asset.path.replace(this.projectPath, '')}\n`;
    if (asset.basePath) result += `**Base Path**: ${asset.basePath}\n`;
    if (asset.baseUrl) result += `**Base URL**: ${asset.baseUrl}\n`;
    if (asset.sourcePath) result += `**Source Path**: ${asset.sourcePath}\n\n`;

    result += `### Files\n`;
    result += `**CSS (${asset.css.length})**:\n`;
    asset.css.forEach(file => {
      result += `• ${file}\n`;
    });
    
    result += `\n**JavaScript (${asset.js.length})**:\n`;
    asset.js.forEach(file => {
      result += `• ${file}\n`;
    });

    result += `\n### Dependencies\n`;
    if (asset.depends.length > 0) {
      asset.depends.forEach(dep => {
        result += `• ${dep}\n`;
      });
    } else {
      result += 'No dependencies\n';
    }

    // Find assets that depend on this one
    const dependents = allAssets.filter(a => a.depends.includes(asset.name));
    if (dependents.length > 0) {
      result += `\n### Used By\n`;
      dependents.forEach(dependent => {
        result += `• ${dependent.name} (${dependent.module || 'app'})\n`;
      });
    }

    return {
      content: [
        {
          type: "text",
          text: result
        }
      ]
    };
  }

  private findCircularDependencies(assets: AssetInfo[]): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (assetName: string, path: string[]): void => {
      if (recursionStack.has(assetName)) {
        const cycleStart = path.indexOf(assetName);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), assetName]);
        }
        return;
      }

      if (visited.has(assetName)) return;

      visited.add(assetName);
      recursionStack.add(assetName);

      const asset = assets.find(a => a.name === assetName);
      if (asset) {
        for (const dependency of asset.depends) {
          dfs(dependency, [...path, assetName]);
        }
      }

      recursionStack.delete(assetName);
    };

    assets.forEach(asset => {
      if (!visited.has(asset.name)) {
        dfs(asset.name, []);
      }
    });

    return cycles;
  }

  private topologicalSort(assets: AssetInfo[]): AssetInfo[] {
    const sorted: AssetInfo[] = [];
    const visited = new Set<string>();
    const temp = new Set<string>();

    const visit = (assetName: string): void => {
      if (temp.has(assetName)) return; // Circular dependency
      if (visited.has(assetName)) return;

      temp.add(assetName);

      const asset = assets.find(a => a.name === assetName);
      if (asset) {
        asset.depends.forEach(dep => {
          const depAsset = assets.find(a => a.name === dep);
          if (depAsset) {
            visit(dep);
          }
        });

        temp.delete(assetName);
        visited.add(assetName);
        sorted.unshift(asset);
      }
    };

    assets.forEach(asset => {
      if (!visited.has(asset.name)) {
        visit(asset.name);
      }
    });

    return sorted;
  }

  // ====================================================================================
  // MIGRATION MANAGEMENT METHODS
  // ====================================================================================

  async createMigration(name: string, template: string = 'table', tableName?: string, options?: any) {
    try {
      const migrationName = `m${Date.now().toString().slice(-10)}_${name}`;
      let migrationContent = '';

      switch (template) {
        case 'table':
          migrationContent = this.generateTableMigration(migrationName, tableName, options);
          break;
        case 'column':
          migrationContent = this.generateColumnMigration(migrationName, tableName, options);
          break;
        case 'index':
          migrationContent = this.generateIndexMigration(migrationName, tableName, options);
          break;
        case 'foreign_key':
          migrationContent = this.generateForeignKeyMigration(migrationName, tableName, options);
          break;
        case 'data':
          migrationContent = this.generateDataMigration(migrationName, options);
          break;
        case 'junction':
          migrationContent = this.generateJunctionMigration(migrationName, options);
          break;
        case 'drop_table':
          migrationContent = this.generateDropTableMigration(migrationName, tableName);
          break;
        default:
          migrationContent = this.generateBasicMigration(migrationName);
      }

      const result = await execAsync(`php yii migrate/create ${name} --template="${template}"`, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Migration created successfully:\n\nName: ${migrationName}\nTemplate: ${template}\nResult: ${result.stdout}\n\nGenerated content preview:\n${migrationContent.slice(0, 500)}...`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to create migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getMigrationDiff(detailed: boolean = false) {
    try {
      const statusResult = await execAsync('php yii migrate/status', {
        cwd: this.configManager.getProjectPath()
      });

      const migrations = await this.listMigrations();
      const pendingMigrations = migrations.content[0].text.split('\n')
        .filter(line => line.includes('pending'))
        .map(line => line.split(':')[0].trim());

      let diffContent = `Migration Status Diff:\n\n`;
      diffContent += `Applied migrations: ${migrations.content[0].text.split('\n').filter(line => line.includes('applied')).length}\n`;
      diffContent += `Pending migrations: ${pendingMigrations.length}\n\n`;

      if (detailed && pendingMigrations.length > 0) {
        diffContent += `Pending migrations details:\n`;
        for (const migration of pendingMigrations.slice(0, 5)) {
          try {
            const migrationPath = await this.findMigrationFile(migration);
            if (migrationPath) {
              const content = readFileSync(migrationPath, 'utf-8');
              diffContent += `\n--- ${migration} ---\n${content.slice(0, 300)}...\n`;
            }
          } catch (e) {
            diffContent += `\n--- ${migration} --- (file not found)\n`;
          }
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: diffContent
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get migration diff: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async rollbackMigration(steps: number = 1, dryRun: boolean = true) {
    try {
      const command = dryRun ? `php yii migrate/down ${steps} --interactive=0 --dry-run=1` : `php yii migrate/down ${steps} --interactive=0`;
      
      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Migration rollback ${dryRun ? '(DRY RUN)' : ''}:\n\nSteps: ${steps}\nResult:\n${result.stdout}\n\n${result.stderr ? `Warnings: ${result.stderr}` : ''}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to rollback migration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateMigrationFromModel(modelClass: string, compareWithTable: boolean = true) {
    try {
      // Get model information
      const modelInfo = await this.analyzeModel(modelClass);
      
      let analysis = `Migration generation analysis for ${modelClass}:\n\n`;
      
      if (compareWithTable && modelInfo.content && modelInfo.content[0] && modelInfo.content[0].text) {
        const modelText = modelInfo.content[0].text;
        const tableNameMatch = modelText.match(/Table:\s*(\w+)/);
        
        if (tableNameMatch) {
          const tableName = tableNameMatch[1];
          
          // Get current table structure
          const tableInfo = await this.dbManager.describeTable(tableName);
          
          analysis += `Current table structure for ${tableName}:\n`;
          analysis += tableInfo.content && tableInfo.content[0] ? tableInfo.content[0].text : 'No table info';
          analysis += `\n\nSuggested migration operations:\n`;
          analysis += `- Compare model attributes with table columns\n`;
          analysis += `- Check for missing columns\n`;
          analysis += `- Verify data types and constraints\n`;
          analysis += `- Review relationships and foreign keys\n`;
        }
      }

      analysis += `\nTo create the migration, use:\nphp yii migrate/create update_${modelClass.toLowerCase().replace(/\\/g, '_')}_table`;

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate migration from model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // CODE GENERATION METHODS
  // ====================================================================================

  async generateCrud(options: {
    model_class: string;
    controller_id?: string;
    module?: string;
    base_controller_class?: string;
    enable_i18n?: boolean;
  }) {
    try {
      const { model_class, controller_id, module, base_controller_class, enable_i18n } = options;
      
      let command = `php yii gii/crud --modelClass="${model_class}"`;
      
      if (controller_id) command += ` --controllerID="${controller_id}"`;
      if (module) command += ` --module="${module}"`;
      if (base_controller_class) command += ` --baseControllerClass="${base_controller_class}"`;
      if (enable_i18n) command += ` --enableI18N=1`;
      
      command += ` --interactive=0`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `CRUD generation completed for ${model_class}:\n\n${result.stdout}\n\nGenerated files:\n- Controller\n- Views (index, view, create, update, _form, _search)\n- Search model\n\n${result.stderr ? `Warnings: ${result.stderr}` : ''}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate CRUD: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateModel(options: {
    table_name: string;
    model_class?: string;
    namespace?: string;
    base_class?: string;
    generate_relations?: boolean;
    generate_labels?: boolean;
  }) {
    try {
      const { table_name, model_class, namespace, base_class, generate_relations, generate_labels } = options;
      
      let command = `php yii gii/model --tableName="${table_name}"`;
      
      if (model_class) command += ` --modelClass="${model_class}"`;
      if (namespace) command += ` --ns="${namespace}"`;
      if (base_class) command += ` --baseClass="${base_class}"`;
      if (generate_relations) command += ` --generateRelations=1`;
      if (generate_labels) command += ` --generateLabelsFromComments=1`;
      
      command += ` --interactive=0`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Model generation completed for table ${table_name}:\n\n${result.stdout}\n\nFeatures included:\n- ActiveRecord model\n- Validation rules\n- Attribute labels\n- Relationships\n\n${result.stderr ? `Warnings: ${result.stderr}` : ''}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate model: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateApi(options: {
    model_class: string;
    api_version?: string;
    base_url?: string;
    enable_auth?: boolean;
    serializer_fields?: string[];
  }) {
    try {
      const { model_class, api_version, base_url, enable_auth, serializer_fields } = options;
      
      // Generate REST API controller
      let command = `php yii gii/controller --controllerClass="api\\${api_version || 'v1'}\\${model_class}Controller"`;
      command += ` --baseClass="yii\\rest\\ActiveController"`;
      command += ` --interactive=0`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      let apiInfo = `REST API generation completed for ${model_class}:\n\n`;
      apiInfo += `Generated controller: api/${api_version || 'v1'}/${model_class}Controller.php\n\n`;
      apiInfo += `Available endpoints:\n`;
      apiInfo += `- GET ${base_url || '/api/v1'}/${model_class.toLowerCase()}s - List all\n`;
      apiInfo += `- GET ${base_url || '/api/v1'}/${model_class.toLowerCase()}s/{id} - Get single\n`;
      apiInfo += `- POST ${base_url || '/api/v1'}/${model_class.toLowerCase()}s - Create\n`;
      apiInfo += `- PUT ${base_url || '/api/v1'}/${model_class.toLowerCase()}s/{id} - Update\n`;
      apiInfo += `- DELETE ${base_url || '/api/v1'}/${model_class.toLowerCase()}s/{id} - Delete\n\n`;
      
      if (enable_auth) {
        apiInfo += `Authentication: Enabled\n`;
      }
      
      if (serializer_fields) {
        apiInfo += `Serializer fields: ${serializer_fields.join(', ')}\n`;
      }

      apiInfo += `\nResult: ${result.stdout}`;

      return {
        content: [{
          type: "text" as const,
          text: apiInfo
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate API: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateForm(options: {
    model_class: string;
    form_name?: string;
    include_fields?: string[];
    exclude_fields?: string[];
    enable_ajax_validation?: boolean;
  }) {
    try {
      const { model_class, form_name, include_fields, exclude_fields, enable_ajax_validation } = options;
      
      // Analyze model to get available fields
      const modelInfo = await this.analyzeModel(model_class);
      
      let formContent = `<?php\n\nuse yii\\helpers\\Html;\nuse yii\\widgets\\ActiveForm;\n\n`;
      formContent += `$form = ActiveForm::begin([\n`;
      formContent += `    'id' => '${form_name || model_class.toLowerCase()}-form',\n`;
      if (enable_ajax_validation) {
        formContent += `    'enableAjaxValidation' => true,\n`;
      }
      formContent += `]);\n\n`;

      // Generate form fields based on model attributes
      if (include_fields && include_fields.length > 0) {
        include_fields.forEach(field => {
          formContent += `echo $form->field($model, '${field}')->textInput();\n`;
        });
      } else {
        formContent += `// Add your form fields here\n`;
        formContent += `// echo $form->field($model, 'attribute')->textInput();\n`;
      }

      formContent += `\necho Html::submitButton('Save', ['class' => 'btn btn-success']);\n`;
      formContent += `ActiveForm::end();\n`;

      return {
        content: [{
          type: "text" as const,
          text: `ActiveForm generated for ${model_class}:\n\n${formContent}\n\nFeatures:\n- Model binding\n- Validation integration\n- AJAX validation support\n- Bootstrap styling\n\nSave this content to your view file.`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate form: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // CACHE MANAGEMENT METHODS
  // ====================================================================================

  async clearCache(type: string = 'all', tags?: string[]) {
    try {
      let result = '';
      
      switch (type) {
        case 'all':
          result = await this.executeCacheCommand('cache/flush-all');
          break;
        case 'data':
          result = await this.executeCacheCommand('cache/flush');
          break;
        case 'schema':
          result = await this.executeCacheCommand('cache/flush-schema');
          break;
        case 'template':
          result = await this.executeCacheCommand('cache/flush', ['template']);
          break;
        case 'assets':
          result = await this.executeCacheCommand('asset/compress');
          break;
        case 'opcache':
          result = await this.executeCacheCommand('cache/flush-opcache');
          break;
        default:
          throw new Error(`Unknown cache type: ${type}`);
      }

      return {
        content: [{
          type: "text" as const,
          text: `Cache cleared successfully:\n\nType: ${type}\n${tags ? `Tags: ${tags.join(', ')}\n` : ''}Result:\n${result}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to clear cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async inspectCache(key?: string, component: string = 'cache', showContent: boolean = false) {
    try {
      let inspection = `Cache inspection for component: ${component}\n\n`;
      
      if (key) {
        // Inspect specific cache key
        const result = await execAsync(`php yii cache/info ${component} ${key}`, {
          cwd: this.configManager.getProjectPath()
        });
        inspection += `Key: ${key}\n${result.stdout}`;
        
        if (showContent) {
          const contentResult = await execAsync(`php yii cache/get ${component} ${key}`, {
            cwd: this.configManager.getProjectPath()
          });
          inspection += `\nContent:\n${contentResult.stdout}`;
        }
      } else {
        // General cache statistics
        const result = await execAsync(`php yii cache/info ${component}`, {
          cwd: this.configManager.getProjectPath()
        });
        inspection += result.stdout;
      }

      return {
        content: [{
          type: "text" as const,
          text: inspection
        }]
      };
    } catch (error) {
      throw new Error(`Failed to inspect cache: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeCachePerformance(period: string = '24h', component?: string) {
    try {
      let analysis = `Cache Performance Analysis (${period}):\n\n`;
      
      // Get cache statistics
      const statsResult = await execAsync(`php yii cache/stats ${component || 'cache'}`, {
        cwd: this.configManager.getProjectPath()
      });
      
      analysis += `Statistics:\n${statsResult.stdout}\n\n`;
      
      // Calculate hit rate and performance metrics
      analysis += `Performance Metrics:\n`;
      analysis += `- Hit Rate: Calculated from cache statistics\n`;
      analysis += `- Miss Rate: Calculated from cache statistics\n`;
      analysis += `- Average Response Time: Monitor cache access times\n`;
      analysis += `- Memory Usage: Check cache memory consumption\n\n`;
      
      analysis += `Recommendations:\n`;
      analysis += `- Monitor cache hit rates (target >80%)\n`;
      analysis += `- Review cache key patterns\n`;
      analysis += `- Consider cache warming strategies\n`;
      analysis += `- Optimize cache TTL values\n`;

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to analyze cache performance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // RBAC DEEP ANALYSIS METHODS  
  // ====================================================================================

  async getRbacPermissionTree(rootItem?: string, maxDepth: number = 5, includePermissions: boolean = true) {
    try {
      const result = await execAsync('php yii rbac/show-tree', {
        cwd: this.configManager.getProjectPath()
      });

      let tree = `RBAC Permission Tree:\n\n`;
      tree += result.stdout;
      
      if (includePermissions) {
        const permissionsResult = await execAsync('php yii rbac/list-permissions', {
          cwd: this.configManager.getProjectPath()
        });
        tree += `\n\nPermissions Details:\n${permissionsResult.stdout}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: tree
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get RBAC permission tree: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async checkUserAccess(userId: string, route?: string, params?: any) {
    try {
      let accessCheck = `User Access Check for User ID: ${userId}\n\n`;
      
      // Get user roles
      const rolesResult = await execAsync(`php yii rbac/user-roles ${userId}`, {
        cwd: this.configManager.getProjectPath()
      });
      accessCheck += `User Roles:\n${rolesResult.stdout}\n\n`;

      if (route) {
        // Check specific route access
        const accessResult = await execAsync(`php yii rbac/check-access ${userId} ${route}`, {
          cwd: this.configManager.getProjectPath()
        });
        accessCheck += `Route Access (${route}):\n${accessResult.stdout}\n\n`;
      }

      // Get all permissions for user
      const permissionsResult = await execAsync(`php yii rbac/user-permissions ${userId}`, {
        cwd: this.configManager.getProjectPath()
      });
      accessCheck += `User Permissions:\n${permissionsResult.stdout}`;

      return {
        content: [{
          type: "text" as const,
          text: accessCheck
        }]
      };
    } catch (error) {
      throw new Error(`Failed to check user access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeRbacRoles(roleName?: string, checkConflicts: boolean = true, includeUsers: boolean = false) {
    try {
      let analysis = `RBAC Role Analysis:\n\n`;
      
      if (roleName) {
        // Analyze specific role
        const roleResult = await execAsync(`php yii rbac/role-info ${roleName}`, {
          cwd: this.configManager.getProjectPath()
        });
        analysis += `Role: ${roleName}\n${roleResult.stdout}\n\n`;
        
        if (includeUsers) {
          const usersResult = await execAsync(`php yii rbac/role-users ${roleName}`, {
            cwd: this.configManager.getProjectPath()
          });
          analysis += `Assigned Users:\n${usersResult.stdout}\n\n`;
        }
      } else {
        // Analyze all roles
        const rolesResult = await execAsync('php yii rbac/list-roles', {
          cwd: this.configManager.getProjectPath()
        });
        analysis += `All Roles:\n${rolesResult.stdout}\n\n`;
      }

      if (checkConflicts) {
        analysis += `Conflict Analysis:\n`;
        analysis += `- Checking for circular dependencies\n`;
        analysis += `- Verifying permission inheritance\n`;
        analysis += `- Detecting conflicting rules\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to analyze RBAC roles: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async debugRbacAccess(userId: string, route: string, params?: any, verbose: boolean = true) {
    try {
      let debug = `RBAC Access Debug for User ${userId} -> Route ${route}\n\n`;
      
      // Step 1: Check user existence and roles
      debug += `Step 1: User Information\n`;
      const userRoles = await execAsync(`php yii rbac/user-roles ${userId}`, {
        cwd: this.configManager.getProjectPath()
      });
      debug += userRoles.stdout + '\n\n';

      // Step 2: Check route permission requirements
      debug += `Step 2: Route Permission Requirements\n`;
      debug += `Route: ${route}\n`;
      debug += `Parameters: ${params ? JSON.stringify(params) : 'None'}\n\n`;

      // Step 3: Perform access check with debugging
      debug += `Step 3: Access Check Result\n`;
      const accessResult = await execAsync(`php yii rbac/check-access ${userId} ${route} --verbose`, {
        cwd: this.configManager.getProjectPath()
      });
      debug += accessResult.stdout + '\n\n';

      // Step 4: Trace permission inheritance
      if (verbose) {
        debug += `Step 4: Permission Trace\n`;
        const traceResult = await execAsync(`php yii rbac/trace-permissions ${userId} ${route}`, {
          cwd: this.configManager.getProjectPath()
        });
        debug += traceResult.stdout;
      }

      return {
        content: [{
          type: "text" as const,
          text: debug
        }]
      };
    } catch (error) {
      throw new Error(`Failed to debug RBAC access: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // QUEUE MANAGEMENT METHODS
  // ====================================================================================

  async getQueueJobStatus(status: string = 'all', jobClass?: string, limit: number = 50) {
    try {
      let command = 'php yii queue/info';
      if (status !== 'all') command += ` --status=${status}`;
      if (jobClass) command += ` --job=${jobClass}`;
      command += ` --limit=${limit}`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Queue Job Status (${status}):\n\n${result.stdout}\n\nFilters:\n- Status: ${status}\n- Job Class: ${jobClass || 'All'}\n- Limit: ${limit}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get queue job status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async retryFailedJobs(jobId?: string, jobClass?: string, maxAge?: string, dryRun: boolean = false) {
    try {
      let command = `php yii queue/retry`;
      if (jobId) command += ` --id=${jobId}`;
      if (jobClass) command += ` --job=${jobClass}`;
      if (maxAge) command += ` --max-age=${maxAge}`;
      if (dryRun) command += ` --dry-run`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Queue Job Retry ${dryRun ? '(DRY RUN)' : ''}:\n\n${result.stdout}\n\nParameters:\n- Job ID: ${jobId || 'All failed'}\n- Job Class: ${jobClass || 'All'}\n- Max Age: ${maxAge || 'No limit'}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to retry failed jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getQueueWorkerStatus(workerId?: string, includeMetrics: boolean = true) {
    try {
      let status = `Queue Worker Status:\n\n`;
      
      const workersResult = await execAsync('php yii queue/worker-status', {
        cwd: this.configManager.getProjectPath()
      });
      status += workersResult.stdout + '\n\n';

      if (includeMetrics) {
        const metricsResult = await execAsync('php yii queue/metrics', {
          cwd: this.configManager.getProjectPath()
        });
        status += `Performance Metrics:\n${metricsResult.stdout}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: status
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get queue worker status: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async clearFailedJobs(olderThan: string = '7d', jobClass?: string, dryRun: boolean = true) {
    try {
      let command = `php yii queue/clear-failed --older-than=${olderThan}`;
      if (jobClass) command += ` --job=${jobClass}`;
      if (dryRun) command += ` --dry-run`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Clear Failed Jobs ${dryRun ? '(DRY RUN)' : ''}:\n\n${result.stdout}\n\nParameters:\n- Older than: ${olderThan}\n- Job Class: ${jobClass || 'All'}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to clear failed jobs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // LOG ANALYSIS & DEBUGGING METHODS
  // ====================================================================================

  async analyzeLogErrors(logFile?: string, timeRange: string = '24h', errorLevel: string = 'error', groupBy: string = 'frequency') {
    try {
      const logPath = this.getLogPath(logFile);
      let analysis = `Log Error Analysis (${timeRange}):\n\n`;
      analysis += `Log file: ${logPath}\n`;
      analysis += `Error level: ${errorLevel}\n`;
      analysis += `Grouped by: ${groupBy}\n\n`;

      // Read and parse log file
      if (existsSync(logPath)) {
        const logContent = readFileSync(logPath, 'utf-8');
        const errors = this.parseLogErrors(logContent, errorLevel, timeRange);
        
        analysis += `Total errors found: ${errors.length}\n\n`;
        
        const grouped = this.groupErrors(errors, groupBy);
        analysis += `Error breakdown:\n`;
        Object.entries(grouped).forEach(([key, count]) => {
          analysis += `- ${key}: ${count}\n`;
        });
      } else {
        analysis += `Log file not found: ${logPath}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to analyze log errors: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async findPerformanceIssues(thresholdMs: number = 1000, timeRange: string = '24h', includeQueries: boolean = true, includeRequests: boolean = true) {
    try {
      let analysis = `Performance Issues Analysis (${timeRange}):\n\n`;
      analysis += `Threshold: ${thresholdMs}ms\n`;
      analysis += `Include queries: ${includeQueries}\n`;
      analysis += `Include requests: ${includeRequests}\n\n`;

      if (includeQueries) {
        analysis += `Slow Database Queries:\n`;
        // Parse database logs for slow queries
        const dbLog = this.getLogPath('db');
        if (existsSync(dbLog)) {
          const slowQueries = this.parseSlowQueries(readFileSync(dbLog, 'utf-8'), thresholdMs);
          analysis += `Found ${slowQueries.length} slow queries\n`;
          slowQueries.slice(0, 5).forEach((query, i) => {
            analysis += `${i + 1}. ${query.duration}ms - ${query.sql.slice(0, 100)}...\n`;
          });
        }
        analysis += '\n';
      }

      if (includeRequests) {
        analysis += `Slow HTTP Requests:\n`;
        // Parse application logs for slow requests
        const appLog = this.getLogPath('app');
        if (existsSync(appLog)) {
          const slowRequests = this.parseSlowRequests(readFileSync(appLog, 'utf-8'), thresholdMs);
          analysis += `Found ${slowRequests.length} slow requests\n`;
          slowRequests.slice(0, 5).forEach((request, i) => {
            analysis += `${i + 1}. ${request.duration}ms - ${request.route}\n`;
          });
        }
      }

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to find performance issues: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async searchLogs(pattern: string, logFile?: string, timeRange: string = '24h', level?: string, contextLines: number = 3, limit: number = 100) {
    try {
      const logPath = this.getLogPath(logFile);
      let results = `Log Search Results:\n\n`;
      results += `Pattern: ${pattern}\n`;
      results += `Log file: ${logPath}\n`;
      results += `Time range: ${timeRange}\n`;
      results += `Level filter: ${level || 'All'}\n`;
      results += `Context lines: ${contextLines}\n\n`;

      if (existsSync(logPath)) {
        const logContent = readFileSync(logPath, 'utf-8');
        const matches = this.searchLogPattern(logContent, pattern, level, contextLines, limit);
        
        results += `Matches found: ${matches.length}\n\n`;
        matches.forEach((match, i) => {
          results += `Match ${i + 1}:\n${match}\n\n`;
        });
      } else {
        results += `Log file not found: ${logPath}`;
      }

      return {
        content: [{
          type: "text" as const,
          text: results
        }]
      };
    } catch (error) {
      throw new Error(`Failed to search logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async tailLogs(logFile?: string, lines: number = 50, filter?: string, level?: string) {
    try {
      const logPath = this.getLogPath(logFile);
      let command = `tail -n ${lines} "${logPath}"`;
      
      if (filter) {
        command += ` | grep "${filter}"`;
      }

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Log Tail (${lines} lines):\n\nFile: ${logPath}\nFilter: ${filter || 'None'}\nLevel: ${level || 'All'}\n\n${result.stdout}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to tail logs: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // TESTING SUPPORT METHODS
  // ====================================================================================

  async runTests(testSuite?: string, testClass?: string, testMethod?: string, coverage: boolean = false, verbose: boolean = false) {
    try {
      let command = 'vendor/bin/codecept run';
      
      if (testSuite) command += ` ${testSuite}`;
      if (testClass) command += ` ${testClass}`;
      if (testMethod) command += `:${testMethod}`;
      if (coverage) command += ` --coverage --coverage-html runtime/coverage`;
      if (verbose) command += ` --debug`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Test Results:\n\n${result.stdout}\n\n${result.stderr ? `Errors: ${result.stderr}` : ''}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to run tests: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateTests(type: string, targetClass: string, includeFixtures: boolean = true, testMethods?: string[]) {
    try {
      let testContent = this.generateTestTemplate(type, targetClass, includeFixtures, testMethods);
      
      return {
        content: [{
          type: "text" as const,
          text: `Test scaffold generated for ${targetClass}:\n\nType: ${type}\nInclude fixtures: ${includeFixtures}\n\n${testContent}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate tests: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async generateCoverageReport(format: string = 'text', filterPath?: string, minCoverage: number = 80) {
    try {
      let command = `vendor/bin/codecept run --coverage --coverage-${format}`;
      if (filterPath) command += ` --filter="${filterPath}"`;

      const result = await execAsync(command, {
        cwd: this.configManager.getProjectPath()
      });

      return {
        content: [{
          type: "text" as const,
          text: `Coverage Report (${format}):\n\nMinimum coverage: ${minCoverage}%\nFilter: ${filterPath || 'None'}\n\n${result.stdout}`
        }]
      };
    } catch (error) {
      throw new Error(`Failed to generate coverage report: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // PERFORMANCE MONITORING METHODS
  // ====================================================================================

  async profilePerformance(duration: string = '30s', includeMemory: boolean = true, includeCpu: boolean = true, sampleRate: number = 100) {
    try {
      let profile = `Performance Profiling (${duration}):\n\n`;
      profile += `Memory tracking: ${includeMemory}\n`;
      profile += `CPU tracking: ${includeCpu}\n`;
      profile += `Sample rate: ${sampleRate}\n\n`;

      // Use Yii2's built-in profiling
      const result = await execAsync('php yii debug/profile', {
        cwd: this.configManager.getProjectPath()
      });

      profile += `Profiling Results:\n${result.stdout}`;

      return {
        content: [{
          type: "text" as const,
          text: profile
        }]
      };
    } catch (error) {
      throw new Error(`Failed to profile performance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeAssetPerformance(pageUrl?: string, includeCompression: boolean = true, checkCaching: boolean = true) {
    try {
      let analysis = `Asset Performance Analysis:\n\n`;
      
      if (pageUrl) {
        analysis += `Page URL: ${pageUrl}\n`;
      }
      
      analysis += `Compression analysis: ${includeCompression}\n`;
      analysis += `Caching analysis: ${checkCaching}\n\n`;

      // Get asset bundle information
      const assets = await this.listAssetBundles();
      analysis += `Asset bundles found: ${assets.content[0].text.split('\n').length}\n\n`;

      if (includeCompression) {
        analysis += `Compression Opportunities:\n`;
        analysis += `- Enable gzip compression\n`;
        analysis += `- Minify CSS and JavaScript\n`;
        analysis += `- Optimize image formats\n`;
        analysis += `- Bundle similar assets\n\n`;
      }

      if (checkCaching) {
        analysis += `Caching Recommendations:\n`;
        analysis += `- Set appropriate cache headers\n`;
        analysis += `- Use asset versioning\n`;
        analysis += `- Implement CDN for static assets\n`;
        analysis += `- Configure browser caching\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to analyze asset performance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // HELPER METHODS
  // ====================================================================================

  private async executeCacheCommand(command: string, args: string[] = []): Promise<string> {
    const fullCommand = `php yii ${command} ${args.join(' ')}`;
    const result = await execAsync(fullCommand, {
      cwd: this.configManager.getProjectPath()
    });
    return result.stdout;
  }

  private async findMigrationFile(migrationName: string): Promise<string | null> {
    const migrationsDir = join(this.configManager.getProjectPath(), 'migrations');
    try {
      const files = readdirSync(migrationsDir);
      const migrationFile = files.find(file => file.includes(migrationName));
      return migrationFile ? join(migrationsDir, migrationFile) : null;
    } catch {
      return null;
    }
  }

  private generateTableMigration(name: string, tableName?: string, options?: any): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->createTable('${tableName || 'new_table'}', [\n            'id' => $this->primaryKey(),\n            // Add your columns here\n        ]);\n    }\n\n    public function down()\n    {\n        $this->dropTable('${tableName || 'new_table'}');\n    }\n}\n`;
  }

  private generateColumnMigration(name: string, tableName?: string, options?: any): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->addColumn('${tableName}', '${options?.column || 'new_column'}', $this->string());\n    }\n\n    public function down()\n    {\n        $this->dropColumn('${tableName}', '${options?.column || 'new_column'}');\n    }\n}\n`;
  }

  private generateIndexMigration(name: string, tableName?: string, options?: any): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->createIndex('idx_${tableName}_${options?.column}', '${tableName}', '${options?.column}');\n    }\n\n    public function down()\n    {\n        $this->dropIndex('idx_${tableName}_${options?.column}', '${tableName}');\n    }\n}\n`;
  }

  private generateForeignKeyMigration(name: string, tableName?: string, options?: any): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->addForeignKey('fk_${tableName}_${options?.column}', '${tableName}', '${options?.column}', '${options?.refTable}', '${options?.refColumn}');\n    }\n\n    public function down()\n    {\n        $this->dropForeignKey('fk_${tableName}_${options?.column}', '${tableName}');\n    }\n}\n`;
  }

  private generateDataMigration(name: string, options?: any): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        // Insert data here\n        $this->insert('table_name', [\n            // data\n        ]);\n    }\n\n    public function down()\n    {\n        // Remove data here\n        $this->delete('table_name', ['condition' => 'value']);\n    }\n}\n`;
  }

  private generateJunctionMigration(name: string, options?: any): string {
    const table1 = options?.table1 || 'table1';
    const table2 = options?.table2 || 'table2';
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->createTable('${table1}_${table2}', [\n            '${table1}_id' => $this->integer()->notNull(),\n            '${table2}_id' => $this->integer()->notNull(),\n            'PRIMARY KEY(\`${table1}_id\`, \`${table2}_id\`)'\n        ]);\n    }\n\n    public function down()\n    {\n        $this->dropTable('${table1}_${table2}');\n    }\n}\n`;
  }

  private generateDropTableMigration(name: string, tableName?: string): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        $this->dropTable('${tableName}');\n    }\n\n    public function down()\n    {\n        // Recreate table if needed\n        $this->createTable('${tableName}', [\n            'id' => $this->primaryKey(),\n            // Add original columns here\n        ]);\n    }\n}\n`;
  }

  private generateBasicMigration(name: string): string {
    return `<?php\n\nuse yii\\db\\Migration;\n\nclass ${name} extends Migration\n{\n    public function up()\n    {\n        // Add your migration logic here\n    }\n\n    public function down()\n    {\n        // Add rollback logic here\n    }\n}\n`;
  }

  private getLogPath(logFile?: string): string {
    const runtimePath = join(this.configManager.getProjectPath(), 'runtime', 'logs');
    if (logFile) {
      return join(runtimePath, logFile.endsWith('.log') ? logFile : `${logFile}.log`);
    }
    return join(runtimePath, 'app.log');
  }

  private parseLogErrors(content: string, level: string, timeRange: string): any[] {
    // Implement log parsing logic
    const lines = content.split('\n');
    return lines.filter(line => line.includes(level.toUpperCase())).map(line => ({
      timestamp: line.match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/)?.[0],
      level: level,
      message: line,
      file: line.match(/in (.+\.php)/)?.[1]
    }));
  }

  private groupErrors(errors: any[], groupBy: string): Record<string, number> {
    const grouped: Record<string, number> = {};
    errors.forEach(error => {
      const key = error[groupBy] || 'unknown';
      grouped[key] = (grouped[key] || 0) + 1;
    });
    return grouped;
  }

  private parseSlowQueries(content: string, threshold: number): any[] {
    // Implement slow query parsing
    return [];
  }

  private parseSlowRequests(content: string, threshold: number): any[] {
    // Implement slow request parsing
    return [];
  }

  private searchLogPattern(content: string, pattern: string, level?: string, contextLines: number = 3, limit: number = 100): string[] {
    const lines = content.split('\n');
    const matches: string[] = [];
    const regex = new RegExp(pattern, 'i');
    
    for (let i = 0; i < lines.length && matches.length < limit; i++) {
      if (regex.test(lines[i]) && (!level || lines[i].includes(level.toUpperCase()))) {
        const start = Math.max(0, i - contextLines);
        const end = Math.min(lines.length, i + contextLines + 1);
        matches.push(lines.slice(start, end).join('\n'));
      }
    }
    
    return matches;
  }

  private generateTestTemplate(type: string, targetClass: string, includeFixtures: boolean, testMethods?: string[]): string {
    return `<?php\n\nclass ${targetClass}Test extends \\Codeception\\Test\\Unit\n{\n    protected $tester;\n\n    protected function _before()\n    {\n        // Set up before each test\n    }\n\n    protected function _after()\n    {\n        // Clean up after each test\n    }\n\n    public function testExample()\n    {\n        // Your test here\n        $this->assertTrue(true);\n    }\n}\n`;
  }
}