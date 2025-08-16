(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./assign", "./expr", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./assign"), require("./expr"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.assign, global.expr, global.util);
    global.proc = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _assign, _expr, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.procToSQL = procToSQL;
  _exports.returnToSQL = returnToSQL;
  function returnToSQL(stmt) {
    const {
      type,
      expr
    } = stmt;
    return [(0, _util.toUpper)(type), (0, _expr.exprToSQL)(expr)].join(' ');
  }
  function procToSQL(expr) {
    const {
      stmt
    } = expr;
    switch (stmt.type) {
      case 'assign':
        return (0, _assign.assignToSQL)(stmt);
      case 'return':
        return returnToSQL(stmt);
    }
  }
});