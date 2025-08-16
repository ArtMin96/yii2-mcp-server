import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
export class ConfigManager {
    dbConfig = null;
    yii2Config = null;
    constructor() {
        this.loadConfigurations();
    }
    loadConfigurations() {
        // Try to find the project root by looking for yii script
        let projectPath = process.cwd();
        // Check if we're in the MCP server directory and need to go up
        if (projectPath.endsWith('yii2-mcp-server')) {
            projectPath = dirname(projectPath);
        }
        // Verify we have a Yii2 project
        const yiiScript = join(projectPath, 'yii');
        if (!existsSync(yiiScript)) {
            throw new Error(`Yii script not found at ${yiiScript}. Please run from Yii2 project root.`);
        }
        this.yii2Config = {
            projectPath,
            yiiScript,
            configPath: join(projectPath, 'config')
        };
        // Load database configuration from .env or config files
        this.loadDatabaseConfig();
    }
    loadDatabaseConfig() {
        if (!this.yii2Config)
            return;
        try {
            // Try to load from .env file first
            const envPath = join(this.yii2Config.projectPath, '.env');
            if (existsSync(envPath)) {
                const envContent = readFileSync(envPath, 'utf-8');
                this.dbConfig = this.parseEnvDatabase(envContent);
                return;
            }
            // Fallback to config/db.php
            const dbConfigPath = join(this.yii2Config.configPath, 'db.php');
            if (existsSync(dbConfigPath)) {
                // For now, use default values - in a real implementation, 
                // you'd parse the PHP config file
                this.dbConfig = {
                    host: 'localhost',
                    port: 3306,
                    database: 'billing',
                    username: 'root',
                    password: '',
                    charset: 'utf8'
                };
            }
        }
        catch (error) {
            console.error('Error loading database config:', error);
        }
    }
    parseEnvDatabase(envContent) {
        const lines = envContent.split('\n');
        const config = {};
        for (const line of lines) {
            const [key, value] = line.split('=', 2);
            if (key && value) {
                config[key.trim()] = value.trim().replace(/^["']|["']$/g, '');
            }
        }
        return {
            host: config.DB_HOST || 'localhost',
            port: parseInt(config.DB_PORT) || 3306,
            database: config.DB_DATABASE || 'billing',
            username: config.DB_USERNAME || 'root',
            password: config.DB_PASSWORD || '',
            charset: config.DB_CHARSET || 'utf8'
        };
    }
    getDatabaseConfig() {
        if (!this.dbConfig) {
            throw new Error('Database configuration not loaded');
        }
        return this.dbConfig;
    }
    getYii2Config() {
        if (!this.yii2Config) {
            throw new Error('Yii2 configuration not loaded');
        }
        return this.yii2Config;
    }
    getProjectPath() {
        return this.getYii2Config().projectPath;
    }
    getConfigPath(filename) {
        return join(this.getYii2Config().configPath, filename);
    }
}
//# sourceMappingURL=config.js.map