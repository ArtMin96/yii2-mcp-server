(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./select", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./select"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.select, global.util);
    global.explain = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _select, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.explainToSQL = explainToSQL;
  function explainToSQL(stmt) {
    const {
      type,
      expr
    } = stmt;
    return [(0, _util.toUpper)(type), (0, _select.selectToSQL)(expr)].join(' ');
  }
});