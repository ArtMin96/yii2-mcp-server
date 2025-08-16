import { ConfigManager } from './config.js';
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
export declare class Yii2Manager {
    private configManager;
    private projectPath;
    private yiiScript;
    constructor(configManager: ConfigManager);
    listCommands(): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getCommandHelp(command: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    executeCommand(command: string, args?: string[], interactive?: boolean): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    listMigrations(): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    listModels(moduleFilter?: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    private scanModelsDirectory;
    private extractTableName;
    private extractRelations;
    analyzeModel(modelClass: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getProjectStructure(): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getModuleInfo(moduleName: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    inspectConfig(configType: 'web' | 'console' | 'db' | 'params'): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getDetailedModuleInfo(moduleName: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    listAssetBundles(moduleFilter?: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    analyzeAssetDependencies(assetName?: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    listWidgets(moduleFilter?: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    private scanDirectory;
    private findAssets;
    private findModuleAssets;
    private parseAssetFile;
    private findWidgets;
    private parseWidgetFile;
    private getAllAssets;
    private analyzeSpecificAsset;
    private findCircularDependencies;
    private topologicalSort;
}
//# sourceMappingURL=yii2.d.ts.map