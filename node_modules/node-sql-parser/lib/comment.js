(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./column", "./util"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./column"), require("./util"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.column, global.util);
    global.comment = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _column, _util) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.commentOnToSQL = commentOnToSQL;
  function commentOptionToSQL(stmt) {
    const {
      name,
      type
    } = stmt;
    switch (type) {
      case 'table':
      case 'view':
        const fullTableName = [(0, _util.identifierToSql)(name.db), (0, _util.identifierToSql)(name.table)].filter(_util.hasVal).join('.');
        return `${(0, _util.toUpper)(type)} ${fullTableName}`;
      case 'column':
        return `COLUMN ${(0, _column.columnRefToSQL)(name)}`;
      default:
        return `${(0, _util.toUpper)(type)} ${(0, _util.literalToSQL)(name)}`;
    }
  }
  function commentIsExprToSQL(stmt) {
    const {
      keyword,
      expr
    } = stmt;
    return [(0, _util.toUpper)(keyword), (0, _util.literalToSQL)(expr)].filter(_util.hasVal).join(' ');
  }
  function commentOnToSQL(stmt) {
    const {
      expr,
      keyword,
      target,
      type
    } = stmt;
    const result = [(0, _util.toUpper)(type), (0, _util.toUpper)(keyword), commentOptionToSQL(target), commentIsExprToSQL(expr)];
    return result.filter(_util.hasVal).join(' ');
  }
});