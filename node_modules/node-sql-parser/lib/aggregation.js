(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./expr", "./util", "./over"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./expr"), require("./util"), require("./over"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.expr, global.util, global.over);
    global.aggregation = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _expr, _util, _over) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.aggrToSQL = aggrToSQL;
  function aggrToSQL(expr) {
    /** @type {Object} */
    const {
      args,
      filter,
      over,
      within_group_orderby
    } = expr;
    let str = (0, _expr.exprToSQL)(args.expr);
    str = Array.isArray(str) ? str.join(', ') : str;
    const fnName = expr.name;
    const overStr = (0, _over.overToSQL)(over);
    const separator = ' ';
    if (args.distinct) str = ['DISTINCT', str].join(separator);
    if (args.separator && args.separator.delimiter) str = [str, (0, _util.literalToSQL)(args.separator.delimiter)].join(`${args.separator.symbol} `);
    if (args.separator && args.separator.expr) str = [str, (0, _expr.exprToSQL)(args.separator.expr)].join(' ');
    if (args.orderby) str = [str, (0, _expr.orderOrPartitionByToSQL)(args.orderby, 'order by')].join(' ');
    if (args.separator && args.separator.value) str = [str, (0, _util.toUpper)(args.separator.keyword), (0, _util.literalToSQL)(args.separator.value)].filter(_util.hasVal).join(' ');
    const withinGroup = within_group_orderby ? `WITHIN GROUP (${(0, _expr.orderOrPartitionByToSQL)(within_group_orderby, 'order by')})` : '';
    const filterStr = filter ? `FILTER (WHERE ${(0, _expr.exprToSQL)(filter.where)})` : '';
    return [`${fnName}(${str})`, withinGroup, overStr, filterStr].filter(_util.hasVal).join(' ');
  }
});