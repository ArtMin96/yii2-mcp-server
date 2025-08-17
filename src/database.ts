import mysql from 'mysql2/promise';
import { ConfigManager, DatabaseConfig } from './config.js';

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

export class DatabaseManager {
  private config: DatabaseConfig;
  private connection: mysql.Connection | null = null;

  constructor(private configManager: ConfigManager) {
    this.config = configManager.getDatabaseConfig();
  }

  private async getConnection(): Promise<mysql.Connection> {
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
          TABLE_ROWS as row_count,
          ROUND(((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024), 2) as size_mb,
          TABLE_COMMENT as comment
        FROM INFORMATION_SCHEMA.TABLES 
        WHERE TABLE_SCHEMA = ?
        ORDER BY TABLE_NAME
      `, [this.config.database]);

      const tableList = (tables as any[]).map(table => ({
        name: table.name,
        type: table.type,
        rows: table.row_count || 0,
        size: `${table.size_mb} MB`,
        comment: table.comment || ''
      }));

      return {
        content: [
          {
            type: "text",
            text: `Found ${tableList.length} tables in database '${this.config.database}':\n\n` +
                  tableList.map(t => 
                    `• ${t.name} (${t.type.toLowerCase()}) - ${t.rows} rows, ${t.size}` +
                    (t.comment ? ` - ${t.comment}` : '')
                  ).join('\n')
          }
        ]
      };
    } catch (error) {
      throw new Error(`Failed to list tables: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async describeTable(tableName: string) {
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

      if ((columns as any[]).length === 0) {
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

      const columnInfo = (columns as any[]).map(col => ({
        name: col.name,
        type: col.type,
        nullable: col.nullable === 'YES',
        default: col.default_value,
        key: col.key_type,
        extra: col.extra,
        comment: col.comment || ''
      }));

      const indexInfo = (indexes as any[]).reduce((acc, idx) => {
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
      result += columnInfo.map(col => 
        `• ${col.name} (${col.type})` +
        (col.nullable ? ' NULL' : ' NOT NULL') +
        (col.default !== null ? ` DEFAULT ${col.default}` : '') +
        (col.key ? ` [${col.key}]` : '') +
        (col.extra ? ` ${col.extra}` : '') +
        (col.comment ? ` - ${col.comment}` : '')
      ).join('\n');

      if (Object.keys(indexInfo).length > 0) {
        result += `\n\nIndexes:\n`;
        result += Object.values(indexInfo).map((idx: any) => 
          `• ${idx.name} (${idx.columns.join(', ')}) - ${idx.unique ? 'UNIQUE' : 'NON-UNIQUE'} ${idx.type}`
        ).join('\n');
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
      throw new Error(`Failed to describe table ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getTableRelationships(tableName: string) {
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
      
      if ((outgoingFKs as any[]).length > 0) {
        result += `Foreign Keys (references to other tables):\n`;
        result += (outgoingFKs as any[]).map(fk => 
          `• ${fk.column_name} → ${fk.referenced_table}.${fk.referenced_column} ` +
          `(ON DELETE ${fk.on_delete}, ON UPDATE ${fk.on_update})`
        ).join('\n');
        result += '\n\n';
      }

      if ((incomingFKs as any[]).length > 0) {
        result += `Incoming References (other tables referencing this table):\n`;
        result += (incomingFKs as any[]).map(fk => 
          `• ${fk.source_table}.${fk.column_name} → ${fk.referenced_column} ` +
          `(ON DELETE ${fk.on_delete}, ON UPDATE ${fk.on_update})`
        ).join('\n');
      }

      if ((outgoingFKs as any[]).length === 0 && (incomingFKs as any[]).length === 0) {
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
    } catch (error) {
      throw new Error(`Failed to get relationships for ${tableName}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async executeQuery(query: string, limit: number = 100) {
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
      const results = rows as any[];

      let result = `Query executed successfully. Found ${results.length} rows.\n\n`;
      
      if (results.length > 0) {
        // Show column headers
        const headers = Object.keys(results[0]);
        result += headers.join(' | ') + '\n';
        result += headers.map(() => '---').join(' | ') + '\n';
        
        // Show data rows
        results.slice(0, 10).forEach(row => {
          result += headers.map(header => 
            row[header] === null ? 'NULL' : String(row[header])
          ).join(' | ') + '\n';
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
    } catch (error) {
      throw new Error(`Query execution failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // DATABASE OPTIMIZATION METHODS
  // ====================================================================================

  async getIndexSuggestions(tableName?: string, analyzeSlowQueries: boolean = true, minQueryTime: number = 1.0) {
    try {
      const connection = await this.getConnection();
      let suggestions = `Database Index Suggestions:\n\n`;
      
      if (tableName) {
        suggestions += `Analyzing table: ${tableName}\n\n`;
        
        // Get table structure
        const [columns] = await connection.execute(`SHOW COLUMNS FROM ${tableName}`);
        const tableColumns = columns as any[];
        
        // Check for missing indexes on foreign key columns
        const foreignKeys = tableColumns.filter(col => 
          col.Field.endsWith('_id') && !col.Key
        );
        
        if (foreignKeys.length > 0) {
          suggestions += `Missing indexes on potential foreign key columns:\n`;
          foreignKeys.forEach(col => {
            suggestions += `- CREATE INDEX idx_${tableName}_${col.Field} ON ${tableName}(${col.Field});\n`;
          });
          suggestions += '\n';
        }
        
        // Check for composite index opportunities
        suggestions += `Composite index opportunities:\n`;
        suggestions += `- Review WHERE clauses that use multiple columns\n`;
        suggestions += `- Consider indexes on (status, created_at) type combinations\n`;
        suggestions += `- Add covering indexes for frequently selected columns\n\n`;
        
      } else {
        // Analyze all tables
        const [tables] = await connection.execute('SHOW TABLES');
        const tableList = tables as any[];
        
        suggestions += `Analyzing ${tableList.length} tables for index opportunities:\n\n`;
        
        for (const table of tableList.slice(0, 10)) {
          const tableName = Object.values(table)[0] as string;
          const [stats] = await connection.execute(`
            SELECT TABLE_NAME, TABLE_ROWS, DATA_LENGTH, INDEX_LENGTH
            FROM information_schema.TABLES 
            WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
          `, [tableName]);
          
          const tableStats = stats as any[];
          if (tableStats.length > 0) {
            const stat = tableStats[0];
            const indexRatio = stat.INDEX_LENGTH / (stat.DATA_LENGTH + stat.INDEX_LENGTH || 1);
            
            if (indexRatio < 0.1 && stat.TABLE_ROWS > 1000) {
              suggestions += `⚠️  ${tableName}: Low index ratio (${(indexRatio * 100).toFixed(1)}%) with ${stat.TABLE_ROWS} rows\n`;
            }
          }
        }
      }
      
      if (analyzeSlowQueries) {
        suggestions += `\nSlow Query Analysis:\n`;
        suggestions += `- Enable slow query log: SET GLOBAL slow_query_log = 'ON'\n`;
        suggestions += `- Set threshold: SET GLOBAL long_query_time = ${minQueryTime}\n`;
        suggestions += `- Monitor queries taking longer than ${minQueryTime}s\n`;
        suggestions += `- Use EXPLAIN on slow queries to identify missing indexes\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: suggestions
        }]
      };
    } catch (error) {
      throw new Error(`Failed to get index suggestions: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async profileQuery(query?: string, explainPlan: boolean = true, analyzeStructure: boolean = true) {
    try {
      const connection = await this.getConnection();
      let profile = `Query Performance Profile:\n\n`;
      
      if (query) {
        profile += `Query: ${query}\n\n`;
        
        if (explainPlan) {
          try {
            const [explain] = await connection.execute(`EXPLAIN ${query}`);
            const explainResults = explain as any[];
            
            profile += `Execution Plan:\n`;
            profile += `| Select Type | Table | Type | Key | Rows | Extra |\n`;
            profile += `|-------------|-------|------|-----|------|-------|\n`;
            
            explainResults.forEach(row => {
              profile += `| ${row.select_type || ''} | ${row.table || ''} | ${row.type || ''} | ${row.key || 'NULL'} | ${row.rows || ''} | ${row.Extra || ''} |\n`;
            });
            profile += '\n';
            
            // Analyze explain output
            const hasFullTableScan = explainResults.some(row => row.type === 'ALL');
            const hasFileSort = explainResults.some(row => row.Extra && row.Extra.includes('Using filesort'));
            const hasTempTable = explainResults.some(row => row.Extra && row.Extra.includes('Using temporary'));
            
            if (hasFullTableScan || hasFileSort || hasTempTable) {
              profile += `⚠️  Performance Warnings:\n`;
              if (hasFullTableScan) profile += `- Full table scan detected - consider adding indexes\n`;
              if (hasFileSort) profile += `- File sort detected - consider adding ORDER BY index\n`;
              if (hasTempTable) profile += `- Temporary table created - review GROUP BY/JOIN clauses\n`;
              profile += '\n';
            }
          } catch (explainError) {
            profile += `Could not generate execution plan: ${explainError}\n\n`;
          }
        }
        
        if (analyzeStructure) {
          profile += `Query Structure Analysis:\n`;
          
          // Basic query analysis
          const queryUpper = query.toUpperCase();
          const hasJoins = queryUpper.includes('JOIN');
          const hasSubqueries = query.includes('(') && queryUpper.includes('SELECT');
          const hasOrderBy = queryUpper.includes('ORDER BY');
          const hasGroupBy = queryUpper.includes('GROUP BY');
          const hasLimit = queryUpper.includes('LIMIT');
          
          profile += `- Joins: ${hasJoins ? 'Yes' : 'No'}\n`;
          profile += `- Subqueries: ${hasSubqueries ? 'Yes' : 'No'}\n`;
          profile += `- Sorting: ${hasOrderBy ? 'Yes' : 'No'}\n`;
          profile += `- Grouping: ${hasGroupBy ? 'Yes' : 'No'}\n`;
          profile += `- Limited: ${hasLimit ? 'Yes' : 'No'}\n\n`;
          
          profile += `Optimization Suggestions:\n`;
          if (hasJoins && !hasLimit) {
            profile += `- Consider adding LIMIT to prevent large result sets\n`;
          }
          if (hasOrderBy && !query.includes('INDEX')) {
            profile += `- Ensure ORDER BY columns are indexed\n`;
          }
          if (hasSubqueries) {
            profile += `- Consider rewriting subqueries as JOINs for better performance\n`;
          }
          if (!hasLimit && queryUpper.includes('SELECT *')) {
            profile += `- Avoid SELECT * and specify only needed columns\n`;
          }
        }
        
      } else {
        // General query profiling advice
        profile += `Query Profiling Guidelines:\n`;
        profile += `- Use EXPLAIN to analyze execution plans\n`;
        profile += `- Monitor slow query log\n`;
        profile += `- Profile queries with SHOW PROFILE\n`;
        profile += `- Use performance_schema for detailed analysis\n`;
        profile += `- Consider query caching for repeated queries\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: profile
        }]
      };
    } catch (error) {
      throw new Error(`Failed to profile query: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async analyzeTable(tableName?: string, includeIndexes: boolean = true, checkFragmentation: boolean = true) {
    try {
      const connection = await this.getConnection();
      let analysis = `Table Analysis:\n\n`;
      
      if (tableName) {
        // Analyze specific table
        analysis += `Table: ${tableName}\n\n`;
        
        // Get basic table information
        const [tableInfo] = await connection.execute(`
          SELECT 
            TABLE_ROWS,
            DATA_LENGTH,
            INDEX_LENGTH,
            DATA_FREE,
            AUTO_INCREMENT,
            CREATE_TIME,
            UPDATE_TIME,
            CHECK_TIME,
            TABLE_COLLATION
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName]);
        
        const info = (tableInfo as any[])[0];
        if (info) {
          analysis += `Basic Information:\n`;
          analysis += `- Rows: ${info.TABLE_ROWS?.toLocaleString() || 'Unknown'}\n`;
          analysis += `- Data Size: ${this.formatBytes(info.DATA_LENGTH || 0)}\n`;
          analysis += `- Index Size: ${this.formatBytes(info.INDEX_LENGTH || 0)}\n`;
          analysis += `- Free Space: ${this.formatBytes(info.DATA_FREE || 0)}\n`;
          analysis += `- Auto Increment: ${info.AUTO_INCREMENT || 'N/A'}\n`;
          analysis += `- Collation: ${info.TABLE_COLLATION}\n`;
          analysis += `- Created: ${info.CREATE_TIME || 'Unknown'}\n`;
          analysis += `- Last Updated: ${info.UPDATE_TIME || 'Unknown'}\n\n`;
          
          // Fragmentation analysis
          if (checkFragmentation && info.DATA_FREE > 0) {
            const fragmentationRatio = info.DATA_FREE / (info.DATA_LENGTH + info.DATA_FREE) * 100;
            analysis += `Fragmentation Analysis:\n`;
            analysis += `- Free space: ${this.formatBytes(info.DATA_FREE)}\n`;
            analysis += `- Fragmentation ratio: ${fragmentationRatio.toFixed(2)}%\n`;
            
            if (fragmentationRatio > 10) {
              analysis += `⚠️  High fragmentation detected! Consider running OPTIMIZE TABLE ${tableName}\n`;
            }
            analysis += '\n';
          }
        }
        
        if (includeIndexes) {
          // Index analysis
          const [indexes] = await connection.execute(`SHOW INDEX FROM ${tableName}`);
          const indexList = indexes as any[];
          
          analysis += `Index Analysis:\n`;
          analysis += `- Total indexes: ${new Set(indexList.map(i => i.Key_name)).size}\n`;
          
          const indexGroups = indexList.reduce((acc, idx) => {
            if (!acc[idx.Key_name]) acc[idx.Key_name] = [];
            acc[idx.Key_name].push(idx);
            return acc;
          }, {} as Record<string, any[]>);
          
          Object.entries(indexGroups).forEach(([indexName, columns]) => {
            const columnNames = (columns as any[]).map(c => c.Column_name).join(', ');
            const isUnique = (columns as any[])[0].Non_unique === 0;
            const cardinality = (columns as any[])[0].Cardinality;
            
            analysis += `- ${indexName}: (${columnNames}) ${isUnique ? '[UNIQUE]' : ''} Cardinality: ${cardinality}\n`;
          });
          analysis += '\n';
          
          // Index efficiency analysis
          if (info && info.TABLE_ROWS > 0) {
            const avgIndexEfficiency = indexList.reduce((sum, idx) => {
              return sum + (idx.Cardinality || 0) / info.TABLE_ROWS;
            }, 0) / indexList.length;
            
            analysis += `Index Efficiency: ${(avgIndexEfficiency * 100).toFixed(1)}%\n`;
            if (avgIndexEfficiency < 0.1) {
              analysis += `⚠️  Low index efficiency detected - review index usage\n`;
            }
            analysis += '\n';
          }
        }
        
        // Storage engine specific analysis
        const [engineInfo] = await connection.execute(`
          SELECT ENGINE FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
        `, [tableName]);
        
        const engine = (engineInfo as any[])[0]?.ENGINE;
        if (engine) {
          analysis += `Storage Engine: ${engine}\n`;
          if (engine === 'MyISAM') {
            analysis += `⚠️  MyISAM detected - consider migrating to InnoDB for better performance and ACID compliance\n`;
          }
          analysis += '\n';
        }
        
      } else {
        // Analyze all tables summary
        const [tables] = await connection.execute(`
          SELECT 
            TABLE_NAME,
            TABLE_ROWS,
            DATA_LENGTH,
            INDEX_LENGTH,
            DATA_FREE,
            ENGINE
          FROM information_schema.TABLES 
          WHERE TABLE_SCHEMA = DATABASE()
          ORDER BY DATA_LENGTH DESC
          LIMIT 20
        `);
        
        const tableList = tables as any[];
        analysis += `Top 20 Tables by Size:\n\n`;
        analysis += `| Table | Rows | Data Size | Index Size | Free Space | Engine |\n`;
        analysis += `|-------|------|-----------|------------|------------|--------|\n`;
        
        tableList.forEach(table => {
          analysis += `| ${table.TABLE_NAME} | ${(table.TABLE_ROWS || 0).toLocaleString()} | ${this.formatBytes(table.DATA_LENGTH || 0)} | ${this.formatBytes(table.INDEX_LENGTH || 0)} | ${this.formatBytes(table.DATA_FREE || 0)} | ${table.ENGINE} |\n`;
        });
        
        // Database summary statistics
        const totalDataSize = tableList.reduce((sum, t) => sum + (t.DATA_LENGTH || 0), 0);
        const totalIndexSize = tableList.reduce((sum, t) => sum + (t.INDEX_LENGTH || 0), 0);
        const totalFreeSpace = tableList.reduce((sum, t) => sum + (t.DATA_FREE || 0), 0);
        
        analysis += `\nDatabase Summary:\n`;
        analysis += `- Total Data Size: ${this.formatBytes(totalDataSize)}\n`;
        analysis += `- Total Index Size: ${this.formatBytes(totalIndexSize)}\n`;
        analysis += `- Total Free Space: ${this.formatBytes(totalFreeSpace)}\n`;
        analysis += `- Index to Data Ratio: ${((totalIndexSize / totalDataSize) * 100).toFixed(1)}%\n`;
      }

      return {
        content: [{
          type: "text" as const,
          text: analysis
        }]
      };
    } catch (error) {
      throw new Error(`Failed to analyze table: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async monitorConnections(duration: string = '5m', alertThreshold: number = 80, includeSlowQueries: boolean = true) {
    try {
      const connection = await this.getConnection();
      let monitoring = `Database Connection Monitoring:\n\n`;
      monitoring += `Duration: ${duration}\n`;
      monitoring += `Alert Threshold: ${alertThreshold} connections\n`;
      monitoring += `Include Slow Queries: ${includeSlowQueries}\n\n`;
      
      // Get current connection status
      const [status] = await connection.execute('SHOW STATUS LIKE "Connections"');
      const [threads] = await connection.execute('SHOW STATUS LIKE "Threads_connected"');
      const [maxConnections] = await connection.execute('SHOW VARIABLES LIKE "max_connections"');
      
      const connectionsStatus = status as any[];
      const threadsStatus = threads as any[];
      const maxConnectionsVar = maxConnections as any[];
      
      const currentConnections = parseInt(threadsStatus[0]?.Value || '0');
      const maxConnectionsValue = parseInt(maxConnectionsVar[0]?.Value || '0');
      const connectionUsage = (currentConnections / maxConnectionsValue) * 100;
      
      monitoring += `Current Status:\n`;
      monitoring += `- Active Connections: ${currentConnections}\n`;
      monitoring += `- Max Connections: ${maxConnectionsValue}\n`;
      monitoring += `- Usage: ${connectionUsage.toFixed(1)}%\n`;
      
      if (currentConnections >= alertThreshold) {
        monitoring += `🚨 Alert: Connection count (${currentConnections}) exceeds threshold (${alertThreshold})\n`;
      }
      monitoring += '\n';
      
      // Connection statistics
      const [abortedConnects] = await connection.execute('SHOW STATUS LIKE "Aborted_connects"');
      const [abortedClients] = await connection.execute('SHOW STATUS LIKE "Aborted_clients"');
      
      monitoring += `Connection Statistics:\n`;
      monitoring += `- Total Connections: ${connectionsStatus[0]?.Value || '0'}\n`;
      monitoring += `- Aborted Connects: ${(abortedConnects as any[])[0]?.Value || '0'}\n`;
      monitoring += `- Aborted Clients: ${(abortedClients as any[])[0]?.Value || '0'}\n\n`;
      
      // Process list
      const [processList] = await connection.execute('SHOW PROCESSLIST');
      const processes = processList as any[];
      
      monitoring += `Active Processes (${processes.length}):\n`;
      monitoring += `| ID | User | Host | DB | Command | Time | State |\n`;
      monitoring += `|----|------|------|----|---------|----- |-------|\n`;
      
      processes.slice(0, 10).forEach(proc => {
        monitoring += `| ${proc.Id} | ${proc.User} | ${proc.Host} | ${proc.db || 'NULL'} | ${proc.Command} | ${proc.Time}s | ${proc.State || ''} |\n`;
      });
      
      if (processes.length > 10) {
        monitoring += `... and ${processes.length - 10} more processes\n`;
      }
      monitoring += '\n';
      
      if (includeSlowQueries) {
        // Slow query analysis
        const [slowQueryStatus] = await connection.execute('SHOW STATUS LIKE "Slow_queries"');
        monitoring += `Slow Query Analysis:\n`;
        monitoring += `- Slow Queries: ${(slowQueryStatus as any[])[0]?.Value || '0'}\n`;
        
        // Check if slow query log is enabled
        const [slowQueryLog] = await connection.execute('SHOW VARIABLES LIKE "slow_query_log"');
        const [longQueryTime] = await connection.execute('SHOW VARIABLES LIKE "long_query_time"');
        
        monitoring += `- Slow Query Log: ${(slowQueryLog as any[])[0]?.Value || 'OFF'}\n`;
        monitoring += `- Long Query Time: ${(longQueryTime as any[])[0]?.Value || '10'}s\n`;
        
        if ((slowQueryLog as any[])[0]?.Value === 'OFF') {
          monitoring += `💡 Recommendation: Enable slow query log for better monitoring\n`;
        }
      }
      
      monitoring += `\nMonitoring Recommendations:\n`;
      monitoring += `- Monitor connection usage regularly\n`;
      monitoring += `- Set up alerts for connection threshold breaches\n`;
      monitoring += `- Review long-running queries\n`;
      monitoring += `- Implement connection pooling if needed\n`;
      monitoring += `- Consider increasing max_connections if usage is consistently high\n`;

      return {
        content: [{
          type: "text" as const,
          text: monitoring
        }]
      };
    } catch (error) {
      throw new Error(`Failed to monitor connections: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // ====================================================================================
  // HELPER METHODS
  // ====================================================================================

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  async close() {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
    }
  }
}