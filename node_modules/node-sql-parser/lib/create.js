(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./alter", "./expr", "./index-definition", "./column", "./command", "./constrain", "./func", "./tables", "./update", "./union", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./alter"), require("./expr"), require("./index-definition"), require("./column"), require("./command"), require("./constrain"), require("./func"), require("./tables"), require("./update"), require("./union"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.alter, global.expr, global.indexDefinition, global.column, global.command, global.constrain, global.func, global.tables, global.update, global.union, global.util);
    global.create = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _alter, _expr, _indexDefinition, _column, _command, _constrain, _func, _tables, _update, _union, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.createDefinitionToSQL = createDefinitionToSQL;
  _exports.createToSQL = createToSQL;
  function createDefinitionToSQL(definition) {
    if (!definition) return [];
    const {
      resource
    } = definition;
    switch (resource) {
      case 'column':
        return (0, _column.columnDefinitionToSQL)(definition);
      case 'index':
        return (0, _indexDefinition.indexDefinitionToSQL)(definition);
      case 'constraint':
        return (0, _constrain.constraintDefinitionToSQL)(definition);
      case 'sequence':
        return [(0, _util.toUpper)(definition.prefix), (0, _expr.exprToSQL)(definition.value)].filter(_util.hasVal).join(' ');
      default:
        throw new Error(`unknown resource = ${resource} type`);
    }
  }
  function forValueItemToSQL(stmt) {
    const {
      keyword
    } = stmt;
    const result = [];
    switch (keyword) {
      case 'from':
        result.push('FROM', `(${(0, _util.literalToSQL)(stmt.from)})`, 'TO', `(${(0, _util.literalToSQL)(stmt.to)})`);
        break;
      case 'in':
        result.push('IN', `(${(0, _expr.exprToSQL)(stmt.in)})`);
        break;
      case 'with':
        result.push('WITH', `(MODULUS ${(0, _util.literalToSQL)(stmt.modulus)}, REMAINDER ${(0, _util.literalToSQL)(stmt.remainder)})`);
        break;
    }
    return result.filter(_util.hasVal).join(' ');
  }
  function createTablePartitionOfToSQL(stmt) {
    const {
      keyword,
      table,
      for_values: forValues,
      tablespace
    } = stmt;
    const result = [(0, _util.toUpper)(keyword), (0, _tables.tableToSQL)(table), (0, _util.toUpper)(forValues.keyword), forValueItemToSQL(forValues.expr)];
    if (tablespace) result.push('TABLESPACE', (0, _util.literalToSQL)(tablespace));
    return result.filter(_util.hasVal).join(' ');
  }
  function createTableToSQL(stmt) {
    const {
      type,
      keyword,
      table,
      like,
      as,
      temporary,
      if_not_exists: ifNotExists,
      create_definitions: createDefinition,
      table_options: tableOptions,
      ignore_replace: ignoreReplace,
      replace: orReplace,
      partition_of: partitionOf,
      query_expr: queryExpr,
      unlogged: unLogged,
      with: withExpr
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(orReplace), (0, _util.toUpper)(temporary), (0, _util.toUpper)(unLogged), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), (0, _tables.tablesToSQL)(table)];
    if (like) {
      const {
        type: likeType,
        table: likeTable
      } = like;
      const likeTableName = (0, _tables.tablesToSQL)(likeTable);
      sql.push((0, _util.toUpper)(likeType), likeTableName);
      return sql.filter(_util.hasVal).join(' ');
    }
    if (partitionOf) return sql.concat([createTablePartitionOfToSQL(partitionOf)]).filter(_util.hasVal).join(' ');
    if (createDefinition) sql.push(`(${createDefinition.map(createDefinitionToSQL).join(', ')})`);
    if (tableOptions) {
      const {
        database
      } = (0, _util.getParserOpt)();
      const symbol = database && database.toLowerCase() === 'sqlite' ? ', ' : ' ';
      sql.push(tableOptions.map(_tables.tableOptionToSQL).join(symbol));
    }
    if (withExpr) {
      const withSQL = withExpr.map(withExprItem => [(0, _util.literalToSQL)(withExprItem.keyword), (0, _util.toUpper)(withExprItem.symbol), (0, _util.literalToSQL)(withExprItem.value)].join(' ')).join(', ');
      sql.push(`WITH (${withSQL})`);
    }
    sql.push((0, _util.toUpper)(ignoreReplace), (0, _util.toUpper)(as));
    if (queryExpr) sql.push((0, _union.unionToSQL)(queryExpr));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createTriggerToSQL(stmt) {
    const {
      definer,
      for_each: forEach,
      keyword,
      execute: triggerBody,
      type,
      table,
      if_not_exists: ife,
      temporary,
      trigger,
      events: triggerEvents,
      order: triggerOrder,
      time: triggerTime,
      when
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(temporary), (0, _expr.exprToSQL)(definer), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ife), (0, _tables.tableToSQL)(trigger), (0, _util.toUpper)(triggerTime), triggerEvents.map(event => {
      const eventStr = [(0, _util.toUpper)(event.keyword)];
      const {
        args
      } = event;
      if (args) eventStr.push((0, _util.toUpper)(args.keyword), args.columns.map(_column.columnRefToSQL).join(', '));
      return eventStr.join(' ');
    }), 'ON', (0, _tables.tableToSQL)(table), (0, _util.toUpper)(forEach && forEach.keyword), (0, _util.toUpper)(forEach && forEach.args), triggerOrder && `${(0, _util.toUpper)(triggerOrder.keyword)} ${(0, _util.identifierToSql)(triggerOrder.trigger)}`, (0, _util.commonOptionConnector)('WHEN', _expr.exprToSQL, when), (0, _util.toUpper)(triggerBody.prefix)];
    switch (triggerBody.type) {
      case 'set':
        sql.push((0, _util.commonOptionConnector)('SET', _update.setToSQL, triggerBody.expr));
        break;
      case 'multiple':
        sql.push((0, _union.multipleToSQL)(triggerBody.expr.ast));
        break;
    }
    sql.push((0, _util.toUpper)(triggerBody.suffix));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createConstraintTriggerToSQL(stmt) {
    const {
      constraint,
      constraint_kw: constraintKw,
      deferrable,
      events,
      execute,
      for_each: forEach,
      from,
      location,
      keyword,
      or,
      type,
      table,
      when
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(or), (0, _util.toUpper)(constraintKw), (0, _util.toUpper)(keyword), (0, _util.identifierToSql)(constraint), (0, _util.toUpper)(location)];
    const event = (0, _util.triggerEventToSQL)(events);
    sql.push(event, 'ON', (0, _tables.tableToSQL)(table));
    if (from) sql.push('FROM', (0, _tables.tableToSQL)(from));
    sql.push(...(0, _util.commonKeywordArgsToSQL)(deferrable), ...(0, _util.commonKeywordArgsToSQL)(forEach));
    if (when) sql.push((0, _util.toUpper)(when.type), (0, _expr.exprToSQL)(when.cond));
    sql.push((0, _util.toUpper)(execute.keyword), (0, _func.funcToSQL)(execute.expr));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createExtensionToSQL(stmt) {
    const {
      extension,
      from,
      if_not_exists: ifNotExists,
      keyword,
      schema,
      type,
      with: withName,
      version
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), (0, _util.literalToSQL)(extension), (0, _util.toUpper)(withName), (0, _util.commonOptionConnector)('SCHEMA', _util.literalToSQL, schema), (0, _util.commonOptionConnector)('VERSION', _util.literalToSQL, version), (0, _util.commonOptionConnector)('FROM', _util.literalToSQL, from)];
    return sql.filter(_util.hasVal).join(' ');
  }
  function createIndexToSQL(stmt) {
    const {
      concurrently,
      filestream_on: fileStream,
      keyword,
      if_not_exists: ifNotExists,
      include,
      index_columns: indexColumns,
      index_type: indexType,
      index_using: indexUsing,
      index,
      on,
      index_options: indexOpt,
      algorithm_option: algorithmOpt,
      lock_option: lockOpt,
      on_kw: onKw,
      table,
      tablespace,
      type,
      where,
      with: withExpr,
      with_before_where: withBeforeWhere
    } = stmt;
    const withIndexOpt = withExpr && `WITH (${(0, _indexDefinition.indexOptionListToSQL)(withExpr).join(', ')})`;
    const includeColumns = include && `${(0, _util.toUpper)(include.keyword)} (${include.columns.map(col => typeof col === 'string' ? (0, _util.identifierToSql)(col) : (0, _expr.exprToSQL)(col)).join(', ')})`;
    let indexName = index;
    if (index) {
      indexName = typeof index === 'string' ? (0, _util.identifierToSql)(index) : [(0, _util.identifierToSql)(index.schema), (0, _util.identifierToSql)(index.name)].filter(_util.hasVal).join('.');
    }
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(indexType), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), (0, _util.toUpper)(concurrently), indexName, (0, _util.toUpper)(onKw), (0, _tables.tableToSQL)(table), ...(0, _indexDefinition.indexTypeToSQL)(indexUsing), `(${(0, _util.columnOrderListToSQL)(indexColumns)})`, includeColumns, (0, _indexDefinition.indexOptionListToSQL)(indexOpt).join(' '), (0, _alter.alterExprToSQL)(algorithmOpt), (0, _alter.alterExprToSQL)(lockOpt), (0, _util.commonOptionConnector)('TABLESPACE', _util.literalToSQL, tablespace)];
    if (withBeforeWhere) {
      sql.push(withIndexOpt, (0, _util.commonOptionConnector)('WHERE', _expr.exprToSQL, where));
    } else {
      sql.push((0, _util.commonOptionConnector)('WHERE', _expr.exprToSQL, where), withIndexOpt);
    }
    sql.push((0, _util.commonOptionConnector)('ON', _expr.exprToSQL, on), (0, _util.commonOptionConnector)('FILESTREAM_ON', _util.literalToSQL, fileStream));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createSequenceToSQL(stmt) {
    const {
      type,
      keyword,
      sequence,
      temporary,
      if_not_exists: ifNotExists,
      create_definitions: createDefinition
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(temporary), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), (0, _tables.tablesToSQL)(sequence)];
    if (createDefinition) sql.push(createDefinition.map(createDefinitionToSQL).join(' '));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createDatabaseOrSchemaToSQL(stmt) {
    const {
      type,
      keyword,
      replace,
      if_not_exists: ifNotExists,
      create_definitions: createDefinition
    } = stmt;
    const {
      db,
      schema
    } = stmt[keyword];
    const name = [(0, _util.literalToSQL)(db), schema.map(_util.literalToSQL).join('.')].filter(_util.hasVal).join('.');
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(replace), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), name];
    if (createDefinition) sql.push(createDefinition.map(_tables.tableOptionToSQL).join(' '));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createViewToSQL(stmt) {
    const {
      algorithm,
      columns,
      definer,
      if_not_exists: ifNotExists,
      keyword,
      recursive,
      replace,
      select,
      sql_security: sqlSecurity,
      temporary,
      type,
      view,
      with: withClause,
      with_options: withOptions
    } = stmt;
    const {
      db,
      schema,
      view: name
    } = view;
    const viewName = [(0, _util.identifierToSql)(db), (0, _util.identifierToSql)(schema), (0, _util.identifierToSql)(name)].filter(_util.hasVal).join('.');
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(replace), (0, _util.toUpper)(temporary), (0, _util.toUpper)(recursive), algorithm && `ALGORITHM = ${(0, _util.toUpper)(algorithm)}`, (0, _expr.exprToSQL)(definer), sqlSecurity && `SQL SECURITY ${(0, _util.toUpper)(sqlSecurity)}`, (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), viewName, columns && `(${columns.map(_util.columnIdentifierToSql).join(', ')})`, withOptions && ['WITH', `(${withOptions.map(withOpt => (0, _util.commonTypeValue)(withOpt).join(' ')).join(', ')})`].join(' '), 'AS', (0, _union.unionToSQL)(select), (0, _util.toUpper)(withClause)];
    return sql.filter(_util.hasVal).join(' ');
  }
  function createDomainToSQL(stmt) {
    const {
      as,
      domain,
      type,
      keyword,
      target,
      create_definitions: createDefinition
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), [(0, _util.identifierToSql)(domain.schema), (0, _util.identifierToSql)(domain.name)].filter(_util.hasVal).join('.'), (0, _util.toUpper)(as), (0, _util.dataTypeToSQL)(target)];
    if (createDefinition && createDefinition.length > 0) {
      const definitionSQL = [];
      for (const definition of createDefinition) {
        const definitionType = definition.type;
        switch (definitionType) {
          case 'collate':
            definitionSQL.push((0, _expr.exprToSQL)(definition));
            break;
          case 'default':
            definitionSQL.push((0, _util.toUpper)(definitionType), (0, _expr.exprToSQL)(definition.value));
            break;
          case 'constraint':
            definitionSQL.push((0, _constrain.constraintDefinitionToSQL)(definition));
            break;
        }
      }
      sql.push(definitionSQL.filter(_util.hasVal).join(' '));
    }
    return sql.filter(_util.hasVal).join(' ');
  }
  function createTypeToSQL(stmt) {
    const {
      as,
      create_definitions: createDefinition,
      keyword,
      name,
      resource,
      type
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), [(0, _util.identifierToSql)(name.schema), (0, _util.identifierToSql)(name.name)].filter(_util.hasVal).join('.'), (0, _util.toUpper)(as), (0, _util.toUpper)(resource)];
    if (createDefinition) {
      const definitionSQL = [];
      switch (resource) {
        case 'enum':
        case 'range':
          definitionSQL.push((0, _expr.exprToSQL)(createDefinition));
          break;
        default:
          definitionSQL.push(`(${createDefinition.map(createDefinitionToSQL).join(', ')})`);
          break;
      }
      sql.push(definitionSQL.filter(_util.hasVal).join(' '));
    }
    return sql.filter(_util.hasVal).join(' ');
  }
  function createFunctionReturnsOptToSQL(stmt) {
    if (stmt.dataType) return (0, _util.dataTypeToSQL)(stmt);
    return [(0, _util.identifierToSql)(stmt.db), (0, _util.identifierToSql)(stmt.schema), (0, _util.identifierToSql)(stmt.table)].filter(_util.hasVal).join('.');
  }
  function createFunctionReturnsToSQL(stmt) {
    const {
      type,
      keyword,
      expr
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), Array.isArray(expr) ? `(${expr.map(_column.columnDefinitionToSQL).join(', ')})` : createFunctionReturnsOptToSQL(expr)];
    return sql.filter(_util.hasVal).join(' ');
  }
  function createFunctionOptionToSQL(stmt) {
    const {
      type
    } = stmt;
    switch (type) {
      case 'as':
        return [(0, _util.toUpper)(type), stmt.symbol, (0, _union.unionToSQL)(stmt.declare), (0, _util.toUpper)(stmt.begin), (0, _union.multipleToSQL)(stmt.expr), (0, _util.toUpper)(stmt.end), stmt.symbol].filter(_util.hasVal).join(' ');
      case 'set':
        return [(0, _util.toUpper)(type), stmt.parameter, (0, _util.toUpper)(stmt.value && stmt.value.prefix), stmt.value && stmt.value.expr.map(_expr.exprToSQL).join(', ')].filter(_util.hasVal).join(' ');
      case 'return':
        return [(0, _util.toUpper)(type), (0, _expr.exprToSQL)(stmt.expr)].filter(_util.hasVal).join(' ');
      default:
        return (0, _expr.exprToSQL)(stmt);
    }
  }
  function createFunctionToSQL(stmt) {
    const {
      type,
      replace,
      keyword,
      name,
      args,
      returns,
      options,
      last
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(replace), (0, _util.toUpper)(keyword)];
    const functionName = [(0, _util.literalToSQL)(name.schema), name.name.map(_util.literalToSQL).join('.')].filter(_util.hasVal).join('.');
    const argsSQL = args.map(_alter.alterArgsToSQL).filter(_util.hasVal).join(', ');
    sql.push(`${functionName}(${argsSQL})`, createFunctionReturnsToSQL(returns), options.map(createFunctionOptionToSQL).join(' '), last);
    return sql.filter(_util.hasVal).join(' ');
  }
  function aggregateOptionToSQL(stmt) {
    const {
      type,
      symbol,
      value
    } = stmt;
    const sql = [(0, _util.toUpper)(type), symbol];
    switch ((0, _util.toUpper)(type)) {
      case 'SFUNC':
        sql.push([(0, _util.identifierToSql)(value.schema), value.name].filter(_util.hasVal).join('.'));
        break;
      case 'STYPE':
      case 'MSTYPE':
        sql.push((0, _util.dataTypeToSQL)(value));
        break;
      default:
        sql.push((0, _expr.exprToSQL)(value));
        break;
    }
    return sql.filter(_util.hasVal).join(' ');
  }
  function createAggregateToSQL(stmt) {
    const {
      type,
      replace,
      keyword,
      name,
      args,
      options
    } = stmt;
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(replace), (0, _util.toUpper)(keyword)];
    const functionName = [(0, _util.identifierToSql)(name.schema), name.name].filter(_util.hasVal).join('.');
    const argsSQL = `${args.expr.map(_alter.alterArgsToSQL).join(', ')}${args.orderby ? [' ORDER', 'BY', args.orderby.map(_alter.alterArgsToSQL).join(', ')].join(' ') : ''}`;
    sql.push(`${functionName}(${argsSQL})`, `(${options.map(aggregateOptionToSQL).join(', ')})`);
    return sql.filter(_util.hasVal).join(' ');
  }
  function createUserToSQL(stmt) {
    const {
      attribute,
      comment,
      default_role: defaultRole,
      if_not_exists: ifNotExists,
      keyword,
      lock_option: lockOption,
      password_options: passwordOptions,
      require: requireOption,
      resource_options: resourceOptions,
      type,
      user
    } = stmt;
    const userAuthOptions = user.map(userAuthOption => {
      const {
        user: userInfo,
        auth_option
      } = userAuthOption;
      const result = [(0, _command.grantUserOrRoleToSQL)(userInfo)];
      if (auth_option) result.push((0, _util.toUpper)(auth_option.keyword), auth_option.auth_plugin, (0, _util.literalToSQL)(auth_option.value));
      return result.filter(_util.hasVal).join(' ');
    }).join(', ');
    const sql = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), userAuthOptions];
    if (defaultRole) sql.push((0, _util.toUpper)(defaultRole.keyword), defaultRole.value.map(_command.grantUserOrRoleToSQL).join(', '));
    sql.push((0, _util.commonOptionConnector)(requireOption && requireOption.keyword, _expr.exprToSQL, requireOption && requireOption.value));
    if (resourceOptions) sql.push((0, _util.toUpper)(resourceOptions.keyword), resourceOptions.value.map(resourceOption => (0, _expr.exprToSQL)(resourceOption)).join(' '));
    if (passwordOptions) passwordOptions.forEach(passwordOption => sql.push((0, _util.commonOptionConnector)(passwordOption.keyword, _expr.exprToSQL, passwordOption.value)));
    sql.push((0, _util.literalToSQL)(lockOption), (0, _util.commentToSQL)(comment), (0, _util.literalToSQL)(attribute));
    return sql.filter(_util.hasVal).join(' ');
  }
  function createToSQL(stmt) {
    const {
      keyword
    } = stmt;
    let sql = '';
    switch (keyword.toLowerCase()) {
      case 'aggregate':
        sql = createAggregateToSQL(stmt);
        break;
      case 'table':
        sql = createTableToSQL(stmt);
        break;
      case 'trigger':
        sql = stmt.resource === 'constraint' ? createConstraintTriggerToSQL(stmt) : createTriggerToSQL(stmt);
        break;
      case 'extension':
        sql = createExtensionToSQL(stmt);
        break;
      case 'function':
        sql = createFunctionToSQL(stmt);
        break;
      case 'index':
        sql = createIndexToSQL(stmt);
        break;
      case 'sequence':
        sql = createSequenceToSQL(stmt);
        break;
      case 'database':
      case 'schema':
        sql = createDatabaseOrSchemaToSQL(stmt);
        break;
      case 'view':
        sql = createViewToSQL(stmt);
        break;
      case 'domain':
        sql = createDomainToSQL(stmt);
        break;
      case 'type':
        sql = createTypeToSQL(stmt);
        break;
      case 'user':
        sql = createUserToSQL(stmt);
        break;
      default:
        throw new Error(`unknown create resource ${keyword}`);
    }
    return sql;
  }
});