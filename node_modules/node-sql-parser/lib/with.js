(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./column", "./expr", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./column"), require("./expr"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.column, global.expr, global.util);
    global._with = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _column, _expr, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.withToSQL = withToSQL;
  /**
   * @param {Array<Object>} withExpr
   */
  function withToSQL(withExpr) {
    if (!withExpr || withExpr.length === 0) return;
    const isRecursive = withExpr[0].recursive ? 'RECURSIVE ' : '';
    const withExprStr = withExpr.map(cte => {
      const {
        name,
        stmt,
        columns
      } = cte;
      const column = Array.isArray(columns) ? `(${columns.map(_column.columnRefToSQL).join(', ')})` : '';
      return `${name.type === 'default' ? (0, _util.identifierToSql)(name.value) : (0, _util.literalToSQL)(name)}${column} AS (${(0, _expr.exprToSQL)(stmt)})`;
    }).join(', ');
    return `WITH ${isRecursive}${withExprStr}`;
  }
});