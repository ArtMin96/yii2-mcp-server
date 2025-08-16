(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util", "./insert", "./tables", "./column", "./update"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"), require("./insert"), require("./tables"), require("./column"), require("./update"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util, global.insert, global.tables, global.column, global.update);
    global.load = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util, _insert, _tables, _column, _update) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.loadDataToSQL = loadDataToSQL;
  function loadDataFields(expr) {
    if (!expr) return '';
    const {
      keyword,
      terminated,
      enclosed,
      escaped
    } = expr;
    return [(0, _util.toUpper)(keyword), (0, _util.literalToSQL)(terminated), (0, _util.literalToSQL)(enclosed), (0, _util.literalToSQL)(escaped)].filter(_util.hasVal).join(' ');
  }
  function loadDataLines(expr) {
    if (!expr) return '';
    const {
      keyword,
      starting,
      terminated
    } = expr;
    return [(0, _util.toUpper)(keyword), (0, _util.literalToSQL)(starting), (0, _util.literalToSQL)(terminated)].filter(_util.hasVal).join(' ');
  }
  function loadDataIgnore(expr) {
    if (!expr) return '';
    const {
      count,
      suffix
    } = expr;
    return ['IGNORE', (0, _util.literalToSQL)(count), suffix].filter(_util.hasVal).join(' ');
  }
  function loadDataToSQL(expr) {
    if (!expr) return '';
    const {
      mode,
      local,
      file,
      replace_ignore,
      table,
      partition,
      character_set,
      column,
      fields,
      lines,
      set,
      ignore
    } = expr;
    const result = ['LOAD DATA', (0, _util.toUpper)(mode), (0, _util.toUpper)(local), 'INFILE', (0, _util.literalToSQL)(file), (0, _util.toUpper)(replace_ignore), 'INTO TABLE', (0, _tables.tableToSQL)(table), (0, _insert.partitionToSQL)(partition), (0, _util.commonOptionConnector)('CHARACTER SET', _util.literalToSQL, character_set), loadDataFields(fields), loadDataLines(lines), loadDataIgnore(ignore), (0, _column.columnsToSQL)(column), (0, _util.commonOptionConnector)('SET', _update.setToSQL, set)];
    return result.filter(_util.hasVal).join(' ');
  }
});