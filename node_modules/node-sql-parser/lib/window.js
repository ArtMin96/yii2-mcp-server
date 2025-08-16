(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util", "./expr", "./over"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"), require("./expr"), require("./over"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util, global.expr, global.over);
    global.window = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util, _expr, _over) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.asWindowSpecToSQL = asWindowSpecToSQL;
  _exports.namedWindowExprListToSQL = namedWindowExprListToSQL;
  _exports.namedWindowExprToSQL = namedWindowExprToSQL;
  _exports.windowFuncToSQL = windowFuncToSQL;
  _exports.windowSpecificationToSQL = windowSpecificationToSQL;
  function windowFrameExprToSQL(windowFrameExpr) {
    if (!windowFrameExpr) return;
    const {
      type
    } = windowFrameExpr;
    if (type === 'rows') {
      return [(0, _util.toUpper)(type), (0, _expr.exprToSQL)(windowFrameExpr.expr)].filter(_util.hasVal).join(' ');
    }
    return (0, _expr.exprToSQL)(windowFrameExpr);
  }
  function windowSpecificationToSQL(windowSpec) {
    const {
      name,
      partitionby,
      orderby,
      window_frame_clause: windowFrame
    } = windowSpec;
    const result = [name, (0, _expr.orderOrPartitionByToSQL)(partitionby, 'partition by'), (0, _expr.orderOrPartitionByToSQL)(orderby, 'order by'), windowFrameExprToSQL(windowFrame)];
    return result.filter(_util.hasVal).join(' ');
  }
  function asWindowSpecToSQL(asWindowSpec) {
    if (typeof asWindowSpec === 'string') return asWindowSpec;
    const {
      window_specification: windowSpec
    } = asWindowSpec;
    return `(${windowSpecificationToSQL(windowSpec)})`;
  }
  function namedWindowExprToSQL(namedWindowExpr) {
    const {
      name,
      as_window_specification: asWindowSpec
    } = namedWindowExpr;
    return `${name} AS ${asWindowSpecToSQL(asWindowSpec)}`;
  }
  function namedWindowExprListToSQL(namedWindowExprInfo) {
    const {
      expr
    } = namedWindowExprInfo;
    return expr.map(namedWindowExprToSQL).join(', ');
  }
  function constructArgsList(expr) {
    const {
      args,
      name,
      consider_nulls = '',
      separator = ', '
    } = expr;
    const argsList = args ? (0, _expr.exprToSQL)(args).join(separator) : '';
    // cover Syntax from FN_NAME(...args [RESPECT NULLS]) [RESPECT NULLS]
    const result = [name, '(', argsList, ')', consider_nulls && ' ', consider_nulls];
    return result.filter(_util.hasVal).join('');
  }
  function windowFuncToSQL(expr) {
    const {
      over
    } = expr;
    const str = constructArgsList(expr);
    const overStr = (0, _over.overToSQL)(over);
    return [str, overStr].filter(_util.hasVal).join(' ');
  }
});