export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
    charset: string;
}
export interface Yii2Config {
    projectPath: string;
    yiiScript: string;
    configPath: string;
}
export declare class ConfigManager {
    private dbConfig;
    private yii2Config;
    constructor();
    private loadConfigurations;
    private loadDatabaseConfig;
    private parseEnvDatabase;
    getDatabaseConfig(): DatabaseConfig;
    getYii2Config(): Yii2Config;
    getProjectPath(): string;
    getConfigPath(filename: string): string;
}
//# sourceMappingURL=config.d.ts.map