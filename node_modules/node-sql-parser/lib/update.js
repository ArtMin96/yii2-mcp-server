(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./tables", "./expr", "./column", "./limit", "./util", "./with"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./tables"), require("./expr"), require("./column"), require("./limit"), require("./util"), require("./with"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.tables, global.expr, global.column, global.limit, global.util, global._with);
    global.update = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _tables, _expr, _column, _limit, _util, _with) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.setToSQL = setToSQL;
  _exports.updateToSQL = updateToSQL;
  /**
   * @param {Array} sets
   * @return {string}
   */
  function setToSQL(sets) {
    if (!sets || sets.length === 0) return '';
    const clauses = [];
    for (const set of sets) {
      const column = {};
      const {
        value
      } = set;
      for (const key in set) {
        if (key === 'value' || key === 'keyword') continue;
        column[key] = set[key];
      }
      const str = (0, _column.columnRefToSQL)(column);
      const setItem = [str];
      let val = '';
      if (value) {
        val = (0, _expr.exprToSQL)(value);
        setItem.push('=', val);
      }
      clauses.push(setItem.filter(_util.hasVal).join(' '));
    }
    return clauses.join(', ');
  }
  function updateToSQL(stmt) {
    const {
      from,
      table,
      set,
      where,
      orderby,
      with: withInfo,
      limit,
      returning
    } = stmt;
    const clauses = [(0, _with.withToSQL)(withInfo), 'UPDATE', (0, _tables.tablesToSQL)(table), (0, _util.commonOptionConnector)('SET', setToSQL, set), (0, _util.commonOptionConnector)('FROM', _tables.tablesToSQL, from), (0, _util.commonOptionConnector)('WHERE', _expr.exprToSQL, where), (0, _expr.orderOrPartitionByToSQL)(orderby, 'order by'), (0, _limit.limitToSQL)(limit), (0, _util.returningToSQL)(returning)];
    return clauses.filter(_util.hasVal).join(' ');
  }
});