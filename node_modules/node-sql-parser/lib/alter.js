(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./column", "./create", "./index-definition", "./tables", "./expr", "./select", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./column"), require("./create"), require("./index-definition"), require("./tables"), require("./expr"), require("./select"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.column, global.create, global.indexDefinition, global.tables, global.expr, global.select, global.util);
    global.alter = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _column, _create, _indexDefinition, _tables, _expr, _select, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.alterArgsToSQL = alterArgsToSQL;
  _exports.alterExprToSQL = alterExprToSQL;
  _exports.alterToSQL = alterToSQL;
  function alterExprPartition(action, expr) {
    switch (action) {
      case 'add':
        const sql = expr.map(({
          name,
          value
        }) => ['PARTITION', (0, _util.literalToSQL)(name), 'VALUES', (0, _util.toUpper)(value.type), `(${(0, _util.literalToSQL)(value.expr)})`].join(' ')).join(', ');
        return `(${sql})`;
      default:
        return (0, _column.columnsToSQL)(expr);
    }
  }
  function alterExprToSQL(expr) {
    if (!expr) return '';
    const {
      action,
      create_definitions: createDefinition,
      if_not_exists: ifNotExists,
      keyword,
      if_exists: ifExists,
      old_column: oldColumn,
      prefix,
      resource,
      symbol,
      suffix
    } = expr;
    let name = '';
    let dataType = [];
    switch (resource) {
      case 'column':
        dataType = [(0, _column.columnDefinitionToSQL)(expr)];
        break;
      case 'index':
        dataType = (0, _indexDefinition.indexTypeAndOptionToSQL)(expr);
        name = expr[resource];
        break;
      case 'table':
      case 'schema':
        name = (0, _util.identifierToSql)(expr[resource]);
        break;
      case 'aggregate':
      case 'function':
      case 'domain':
      case 'type':
        name = (0, _util.identifierToSql)(expr[resource]);
        break;
      case 'algorithm':
      case 'lock':
      case 'table-option':
        name = [symbol, (0, _util.toUpper)(expr[resource])].filter(_util.hasVal).join(' ');
        break;
      case 'constraint':
        name = (0, _util.identifierToSql)(expr[resource]);
        dataType = [(0, _create.createDefinitionToSQL)(createDefinition)];
        break;
      case 'partition':
        dataType = [alterExprPartition(action, expr.partitions)];
        break;
      case 'key':
        name = (0, _util.identifierToSql)(expr[resource]);
        break;
      default:
        name = [symbol, expr[resource]].filter(val => val !== null).join(' ');
        break;
    }
    const alterArray = [(0, _util.toUpper)(action), (0, _util.toUpper)(keyword), (0, _util.toUpper)(ifNotExists), (0, _util.toUpper)(ifExists), oldColumn && (0, _column.columnRefToSQL)(oldColumn), (0, _util.toUpper)(prefix), name && name.trim(), dataType.filter(_util.hasVal).join(' ')];
    if (suffix) {
      alterArray.push((0, _util.toUpper)(suffix.keyword), suffix.expr && (0, _column.columnRefToSQL)(suffix.expr));
    }
    return alterArray.filter(_util.hasVal).join(' ');
  }
  function alterTableToSQL(stmt) {
    const {
      type,
      table,
      if_exists,
      prefix,
      expr = []
    } = stmt;
    const action = (0, _util.toUpper)(type);
    const tableName = (0, _tables.tablesToSQL)(table);
    const exprList = expr.map(_expr.exprToSQL);
    const result = [action, 'TABLE', (0, _util.toUpper)(if_exists), (0, _util.literalToSQL)(prefix), tableName, exprList.join(', ')];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterViewToSQL(stmt) {
    const {
      type,
      columns,
      attributes,
      select,
      view,
      with: withExpr
    } = stmt;
    const action = (0, _util.toUpper)(type);
    const viewName = (0, _tables.tableToSQL)(view);
    const result = [action, 'VIEW', viewName];
    if (columns) result.push(`(${columns.map(_column.columnRefToSQL).join(', ')})`);
    if (attributes) result.push(`WITH ${attributes.map(_util.toUpper).join(', ')}`);
    result.push('AS', (0, _select.selectToSQL)(select));
    if (withExpr) result.push((0, _util.toUpper)(withExpr));
    return result.filter(_util.hasVal).join(' ');
  }
  function alterArgsToSQL(arg) {
    const defaultSQL = arg.default && [(0, _util.toUpper)(arg.default.keyword), (0, _expr.exprToSQL)(arg.default.value)].join(' ');
    return [(0, _util.toUpper)(arg.mode), arg.name, (0, _util.dataTypeToSQL)(arg.type), defaultSQL].filter(_util.hasVal).join(' ');
  }
  function alterSchemaToSQL(stmt) {
    const {
      expr,
      keyword,
      schema,
      type
    } = stmt;
    const result = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), (0, _util.identifierToSql)(schema), alterExprToSQL(expr)];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterDomainTypeToSQL(stmt) {
    const {
      expr,
      keyword,
      name,
      type
    } = stmt;
    const result = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), [(0, _util.identifierToSql)(name.schema), (0, _util.identifierToSql)(name.name)].filter(_util.hasVal).join('.'), alterExprToSQL(expr)];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterFunctionToSQL(stmt) {
    const {
      args,
      expr,
      keyword,
      name,
      type
    } = stmt;
    const result = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), [[(0, _util.identifierToSql)(name.schema), (0, _util.identifierToSql)(name.name)].filter(_util.hasVal).join('.'), args && `(${args.expr ? args.expr.map(alterArgsToSQL).join(', ') : ''})`].filter(_util.hasVal).join(''), alterExprToSQL(expr)];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterAggregateToSQL(stmt) {
    const {
      args,
      expr,
      keyword,
      name,
      type
    } = stmt;
    const {
      expr: argsExpr,
      orderby
    } = args;
    const result = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), [[(0, _util.identifierToSql)(name.schema), (0, _util.identifierToSql)(name.name)].filter(_util.hasVal).join('.'), `(${argsExpr.map(alterArgsToSQL).join(', ')}${orderby ? [' ORDER', 'BY', orderby.map(alterArgsToSQL).join(', ')].join(' ') : ''})`].filter(_util.hasVal).join(''), alterExprToSQL(expr)];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterSequenceToSQL(stmt) {
    const {
      type,
      keyword,
      sequence,
      if_exists,
      expr = []
    } = stmt;
    const action = (0, _util.toUpper)(type);
    const sequenceName = (0, _tables.tablesToSQL)(sequence);
    const exprList = expr.map(_create.createDefinitionToSQL);
    const result = [action, (0, _util.toUpper)(keyword), (0, _util.toUpper)(if_exists), sequenceName, exprList.join(', ')];
    return result.filter(_util.hasVal).join(' ');
  }
  function alterToSQL(stmt) {
    const {
      keyword = 'table'
    } = stmt;
    switch (keyword) {
      case 'aggregate':
        return alterAggregateToSQL(stmt);
      case 'table':
        return alterTableToSQL(stmt);
      case 'schema':
        return alterSchemaToSQL(stmt);
      case 'sequence':
        return alterSequenceToSQL(stmt);
      case 'domain':
      case 'type':
        return alterDomainTypeToSQL(stmt);
      case 'function':
        return alterFunctionToSQL(stmt);
      case 'view':
        return alterViewToSQL(stmt);
    }
  }
});