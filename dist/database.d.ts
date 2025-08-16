import { ConfigManager } from './config.js';
export interface TableInfo {
    name: string;
    type: string;
    rows: number;
    size: string;
    comment: string;
}
export interface ColumnInfo {
    name: string;
    type: string;
    nullable: boolean;
    default: string | null;
    key: string;
    extra: string;
    comment: string;
}
export interface ForeignKey {
    constraintName: string;
    columnName: string;
    referencedTable: string;
    referencedColumn: string;
    onDelete: string;
    onUpdate: string;
}
export declare class DatabaseManager {
    private configManager;
    private config;
    private connection;
    constructor(configManager: ConfigManager);
    private getConnection;
    listTables(): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    describeTable(tableName: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    getTableRelationships(tableName: string): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    executeQuery(query: string, limit?: number): Promise<{
        content: {
            type: string;
            text: string;
        }[];
    }>;
    close(): Promise<void>;
}
//# sourceMappingURL=database.d.ts.map