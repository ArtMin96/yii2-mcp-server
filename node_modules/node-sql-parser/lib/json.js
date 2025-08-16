(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./expr", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./expr"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.expr, global.util);
    global.json = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _expr, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.jsonExprToSQL = jsonExprToSQL;
  _exports.jsonVisitorExprToSQL = jsonVisitorExprToSQL;
  function jsonExprToSQL(expr) {
    const {
      keyword,
      expr_list: exprList
    } = expr;
    const result = [(0, _util.toUpper)(keyword), exprList.map(exprItem => (0, _expr.exprToSQL)(exprItem)).join(', ')].join(' ');
    return result;
  }
  function jsonVisitorExprToSQL(stmt) {
    const {
      symbol,
      expr
    } = stmt;
    return [symbol, (0, _expr.exprToSQL)(expr)].join('');
  }
});