(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util", "./expr"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"), require("./expr"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util, global.expr);
    global.interval = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util, _expr) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.intervalToSQL = intervalToSQL;
  function intervalToSQL(intervalExpr) {
    const {
      expr,
      unit,
      suffix
    } = intervalExpr;
    const result = ['INTERVAL', (0, _expr.exprToSQL)(expr), (0, _util.toUpper)(unit), (0, _expr.exprToSQL)(suffix)];
    return result.filter(_util.hasVal).join(' ');
  }
});