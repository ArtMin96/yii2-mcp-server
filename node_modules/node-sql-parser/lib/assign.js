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
    global.assign = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _expr, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.assignToSQL = assignToSQL;
  function assignToSQL(expr) {
    /** @type {Object} */
    const {
      left,
      right,
      symbol,
      keyword
    } = expr;
    left.keyword = keyword;
    const leftVar = (0, _expr.exprToSQL)(left);
    const rightVal = (0, _expr.exprToSQL)(right);
    return [leftVar, (0, _util.toUpper)(symbol), rightVal].filter(_util.hasVal).join(' ');
  }
});