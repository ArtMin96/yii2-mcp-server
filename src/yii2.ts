import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, extname, basename, dirname } from 'path';
import { ConfigManager } from './config.js';

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

  constructor(private configManager: ConfigManager) {
    const config = configManager.getYii2Config();
    this.projectPath = config.projectPath;
    this.yiiScript = config.yiiScript;
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
}