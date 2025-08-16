(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util);
    global.transaction = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.transactionToSQL = transactionToSQL;
  function transactionToSQL(stmt) {
    const {
      expr: {
        action,
        keyword,
        modes
      }
    } = stmt;
    const result = [(0, _util.literalToSQL)(action), (0, _util.toUpper)(keyword)];
    if (modes) result.push(modes.map(_util.literalToSQL).join(', '));
    return result.filter(_util.hasVal).join(' ');
  }
});