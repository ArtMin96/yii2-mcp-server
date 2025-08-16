(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util", "./alter", "./aggregation", "./assign", "./binary", "./case", "./collate", "./column", "./func", "./insert", "./interval", "./json", "./select", "./show", "./array-struct", "./load", "./tables", "./union", "./window"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"), require("./alter"), require("./aggregation"), require("./assign"), require("./binary"), require("./case"), require("./collate"), require("./column"), require("./func"), require("./insert"), require("./interval"), require("./json"), require("./select"), require("./show"), require("./array-struct"), require("./load"), require("./tables"), require("./union"), require("./window"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util, global.alter, global.aggregation, global.assign, global.binary, global._case, global.collate, global.column, global.func, global.insert, global.interval, global.json, global.select, global.show, global.arrayStruct, global.load, global.tables, global.union, global.window);
    global.expr = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util, _alter, _aggregation, _assign, _binary, _case, _collate, _column, _func, _insert, _interval, _json, _select, _show, _arrayStruct, _load, _tables, _union, _window) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.exprToSQL = exprToSQL;
  _exports.exprToSQLConvertFn = void 0;
  _exports.getExprListSQL = getExprListSQL;
  _exports.orderOrPartitionByToSQL = orderOrPartitionByToSQL;
  _exports.varToSQL = varToSQL;
  const exprToSQLConvertFn = _exports.exprToSQLConvertFn = {
    alter: _alter.alterExprToSQL,
    aggr_func: _aggregation.aggrToSQL,
    any_value: _func.anyValueFuncToSQL,
    window_func: _window.windowFuncToSQL,
    'array': _arrayStruct.arrayStructExprToSQL,
    assign: _assign.assignToSQL,
    binary_expr: _binary.binaryToSQL,
    case: _case.caseToSQL,
    cast: _func.castToSQL,
    collate: _collate.collateToSQL,
    column_ref: _column.columnRefToSQL,
    column_definition: _column.columnDefinitionToSQL,
    datatype: _util.dataTypeToSQL,
    extract: _func.extractFunToSQL,
    flatten: _func.flattenFunToSQL,
    fulltext_search: _column.fullTextSearchToSQL,
    function: _func.funcToSQL,
    lambda: _func.lambdaToSQL,
    load_data: _load.loadDataToSQL,
    insert: _union.unionToSQL,
    interval: _interval.intervalToSQL,
    json: _json.jsonExprToSQL,
    json_object_arg: _func.jsonObjectArgToSQL,
    json_visitor: _json.jsonVisitorExprToSQL,
    func_arg: _func.funcArgToSQL,
    show: _show.showToSQL,
    struct: _arrayStruct.arrayStructExprToSQL,
    tablefunc: _func.tablefuncFunToSQL,
    tables: _tables.tablesToSQL,
    unnest: _tables.unnestToSQL,
    values: _insert.valuesToSQL,
    'window': _window.namedWindowExprListToSQL
  };
  function varToSQL(expr) {
    const {
      prefix = '@',
      name,
      members,
      quoted,
      suffix
    } = expr;
    const val = [];
    const varName = members && members.length > 0 ? `${name}.${members.join('.')}` : name;
    let result = `${prefix || ''}${varName}`;
    if (suffix) result += suffix;
    val.push(result);
    return [quoted, val.join(' '), quoted].filter(_util.hasVal).join('');
  }
  exprToSQLConvertFn.var = varToSQL;
  function exprToSQL(exprOrigin) {
    if (!exprOrigin) return;
    const expr = exprOrigin;
    if (exprOrigin.ast) {
      const {
        ast
      } = expr;
      Reflect.deleteProperty(expr, ast);
      for (const key of Object.keys(ast)) {
        expr[key] = ast[key];
      }
    }
    const {
      type
    } = expr;
    if (type === 'expr') return exprToSQL(expr.expr);
    return exprToSQLConvertFn[type] ? exprToSQLConvertFn[type](expr) : (0, _util.literalToSQL)(expr);
  }
  function unaryToSQL(unarExpr) {
    const {
      operator,
      parentheses,
      expr
    } = unarExpr;
    const space = operator === '-' || operator === '+' || operator === '~' || operator === '!' ? '' : ' ';
    const str = `${operator}${space}${exprToSQL(expr)}`;
    return parentheses ? `(${str})` : str;
  }
  function getExprListSQL(exprList) {
    if (!exprList) return [];
    if (!Array.isArray(exprList)) exprList = [exprList];
    return exprList.map(exprToSQL);
  }
  exprToSQLConvertFn.expr_list = expr => {
    const result = getExprListSQL(expr.value);
    const {
      parentheses,
      separator
    } = expr;
    if (!parentheses && !separator) return result;
    const joinSymbol = separator || ', ';
    const str = result.join(joinSymbol);
    return parentheses ? `(${str})` : str;
  };
  exprToSQLConvertFn.select = expr => {
    const str = typeof expr._next === 'object' ? (0, _union.unionToSQL)(expr) : (0, _select.selectToSQL)(expr);
    return expr.parentheses ? `(${str})` : str;
  };
  exprToSQLConvertFn.unary_expr = unaryToSQL;
  function mapObjectToSQL(mapExpr) {
    const {
      keyword,
      expr
    } = mapExpr;
    const exprStr = expr.map(exprItem => [(0, _util.literalToSQL)(exprItem.key), (0, _util.literalToSQL)(exprItem.value)].join(', ')).join(', ');
    return [(0, _util.toUpper)(keyword), `[${exprStr}]`].join('');
  }
  exprToSQLConvertFn.map_object = mapObjectToSQL;
  function orderOrPartitionByToSQL(expr, prefix) {
    if (!Array.isArray(expr)) return '';
    let expressions = [];
    const upperPrefix = (0, _util.toUpper)(prefix);
    switch (upperPrefix) {
      case 'ORDER BY':
        expressions = expr.map(info => [exprToSQL(info.expr), info.type || 'ASC', (0, _util.toUpper)(info.nulls)].filter(_util.hasVal).join(' '));
        break;
      case 'PARTITION BY':
        expressions = expr.map(info => exprToSQL(info.expr));
        break;
      default:
        expressions = expr.map(info => exprToSQL(info.expr));
        break;
    }
    return (0, _util.connector)(upperPrefix, expressions.join(', '));
  }
});