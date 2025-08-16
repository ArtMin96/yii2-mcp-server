import mysql from 'mysql2/promise';
export class DatabaseManager {
    configManager;
    config;
    connection = null;
    constructor(configManager) {
        this.configManager = configManager;
        this.config = configManager.getDatabaseConfig();
    }
    async getConnection() {
        if (!this.connection) {
            this.connection = await mysql.createConnection({
                host: this.config.host,
                port: this.config.port,
                user: this.config.username,
                password: this.config.password,
                database: this.config.database,
                charset: this.config.charset
            });
        }
        return this.connection;
    }
    async listTables() {
        try {
            const connection = await this.getConnection();
            const [tables] = await connection.execute(`
        SELECT 
          TABLE_NAME as name,
          TABLE_TYPE as type,
          TABLE_ROWS as rows,
          ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb,
          TABLE_COMMENT as comment
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
      `, [this.config.database]);
            const tableList = tables.map(table => ({
                name: table.name,
                type: table.type,
                rows: table.rows || 0,
                size: `${table.size_mb} MB`,
                comment: table.comment || ''
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: `Found ${tableList.length} tables in database '${this.config.database}':\n\n` +
                            tableList.map(t => `• ${t.name} (${t.type.toLowerCase()}) - ${t.rows} rows, ${t.size}` +
                                (t.comment ? ` - ${t.comment}` : '')).join('\n')
                    }
                ]
            };
        }
        catch (error) {
            throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async describeTable(tableName) {
        try {
            const connection = await this.getConnection();
            // Get column information
            const [columns] = await connection.execute(`
        SELECT 
          COLUMN_NAME as name,
          COLUMN_TYPE as type,
          IS_NULLABLE as nullable,
          COLUMN_DEFAULT as default_value,
          COLUMN_KEY as key_type,
          EXTRA as extra,
          COLUMN_COMMENT as comment
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `, [this.config.database, tableName]);
            if (columns.length === 0) {
                throw new Error(`Table '${tableName}' not found`);
            }
            // Get indexes
            const [indexes] = await connection.execute(`
        SELECT 
          INDEX_NAME as name,
          COLUMN_NAME as column_name,
          NON_UNIQUE as non_unique,
          INDEX_TYPE as type
        FROM INFORMATION_SCHEMA.STATISTICS 
        WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
        ORDER BY INDEX_NAME, SEQ_IN_INDEX
      `, [this.config.database, tableName]);
            const columnInfo = columns.map(col => ({
                name: col.name,
                type: col.type,
                nullable: col.nullable === 'YES',
                default: col.default_value,
                key: col.key_type,
                extra: col.extra,
                comment: col.comment || ''
            }));
            const indexInfo = indexes.reduce((acc, idx) => {
                if (!acc[idx.name]) {
                    acc[idx.name] = {
                        name: idx.name,
                        columns: [],
                        unique: idx.non_unique === 0,
                        type: idx.type
                    };
                }
                acc[idx.name].columns.push(idx.column_name);
                return acc;
            }, {});
            let result = `Table: ${tableName}\n\n`;
            result += `Columns:\n`;
            result += columnInfo.map(col => `• ${col.name} (${col.type})` +
                (col.nullable ? ' NULL' : ' NOT NULL') +
                (col.default !== null ? ` DEFAULT ${col.default}` : '') +
                (col.key ? ` [${col.key}]` : '') +
                (col.extra ? ` ${col.extra}` : '') +
                (col.comment ? ` - ${col.comment}` : '')).join('\n');
            if (Object.keys(indexInfo).length > 0) {
                result += `\n\nIndexes:\n`;
                result += Object.values(indexInfo).map((idx) => `• ${idx.name} (${idx.columns.join(', ')}) - ${idx.unique ? 'UNIQUE' : 'NON-UNIQUE'} ${idx.type}`).join('\n');
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
        catch (error) {
            throw new Error(`Failed to describe table ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async getTableRelationships(tableName) {
        try {
            const connection = await this.getConnection();
            // Get foreign keys FROM this table
            const [outgoingFKs] = await connection.execute(`
        SELECT 
          CONSTRAINT_NAME as constraint_name,
          COLUMN_NAME as column_name,
          REFERENCED_TABLE_NAME as referenced_table,
          REFERENCED_COLUMN_NAME as referenced_column,
          DELETE_RULE as on_delete,
          UPDATE_RULE as on_update
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = ? AND kcu.TABLE_NAME = ? AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
      `, [this.config.database, tableName]);
            // Get foreign keys TO this table
            const [incomingFKs] = await connection.execute(`
        SELECT 
          CONSTRAINT_NAME as constraint_name,
          TABLE_NAME as source_table,
          COLUMN_NAME as column_name,
          REFERENCED_COLUMN_NAME as referenced_column,
          DELETE_RULE as on_delete,
          UPDATE_RULE as on_update
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
        JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
        WHERE kcu.TABLE_SCHEMA = ? AND kcu.REFERENCED_TABLE_NAME = ?
      `, [this.config.database, tableName]);
            let result = `Relationships for table: ${tableName}\n\n`;
            if (outgoingFKs.length > 0) {
                result += `Foreign Keys (references to other tables):\n`;
                result += outgoingFKs.map(fk => `• ${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column} ` +
                    `(ON DELETE ${fk.on_delete}, ON UPDATE ${fk.on_update})`).join('\n');
                result += '\n\n';
            }
            if (incomingFKs.length > 0) {
                result += `Incoming References (other tables referencing this table):\n`;
                result += incomingFKs.map(fk => `• ${fk.source_table}.${fk.column_name} → ${fk.referenced_column} ` +
                    `(ON DELETE ${fk.on_delete}, ON UPDATE ${fk.on_update})`).join('\n');
            }
            if (outgoingFKs.length === 0 && incomingFKs.length === 0) {
                result += 'No foreign key relationships found.';
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
        catch (error) {
            throw new Error(`Failed to get relationships for ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async executeQuery(query, limit = 100) {
        try {
            // Security check - only allow SELECT queries
            const trimmedQuery = query.trim().toLowerCase();
            if (!trimmedQuery.startsWith('select')) {
                throw new Error('Only SELECT queries are allowed for security reasons');
            }
            const connection = await this.getConnection();
            // Add limit if not present
            let finalQuery = query;
            if (!trimmedQuery.includes('limit')) {
                finalQuery += ` LIMIT ${limit}`;
            }
            const [rows, fields] = await connection.execute(finalQuery);
            const results = rows;
            let result = `Query executed successfully. Found ${results.length} rows.\n\n`;
            if (results.length > 0) {
                // Show column headers
                const headers = Object.keys(results[0]);
                result += headers.join(' | ') + '\n';
                result += headers.map(() => '---').join(' | ') + '\n';
                // Show data rows
                results.slice(0, 10).forEach(row => {
                    result += headers.map(header => row[header] === null ? 'NULL' : String(row[header])).join(' | ') + '\n';
                });
                if (results.length > 10) {
                    result += `\n... and ${results.length - 10} more rows`;
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
        }
        catch (error) {
            throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    async close() {
        if (this.connection) {
            await this.connection.end();
            this.connection = null;
        }
    }
}
//# sourceMappingURL=database.js.map