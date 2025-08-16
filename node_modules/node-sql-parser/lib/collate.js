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
    global.collate = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _expr, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.collateToSQL = collateToSQL;
  function collateToSQL(stmt) {
    if (!stmt) return;
    const {
      keyword,
      collate: {
        name,
        symbol,
        value
      }
    } = stmt;
    const result = [(0, _util.toUpper)(keyword)];
    if (!value) result.push(symbol);
    result.push(Array.isArray(name) ? name.map(_util.literalToSQL).join('.') : (0, _util.literalToSQL)(name));
    if (value) result.push(symbol);
    result.push((0, _expr.exprToSQL)(value));
    return result.filter(_util.hasVal).join(' ');
  }
});