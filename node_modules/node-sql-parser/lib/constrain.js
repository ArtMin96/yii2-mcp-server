(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "./util", "./index-definition", "./column"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("./util"), require("./index-definition"), require("./column"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.util, global.indexDefinition, global.column);
    global.constrain = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _util, _indexDefinition, _column) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.constraintDefinitionToSQL = constraintDefinitionToSQL;
  function constraintDefinitionToSQL(constraintDefinition) {
    if (!constraintDefinition) return;
    const {
      constraint,
      constraint_type: constraintType,
      enforced,
      index,
      keyword,
      reference_definition: referenceDefinition,
      for: forColumn,
      with_values: withValues
    } = constraintDefinition;
    const constraintSQL = [];
    const {
      database
    } = (0, _util.getParserOpt)();
    constraintSQL.push((0, _util.toUpper)(keyword));
    constraintSQL.push((0, _util.identifierToSql)(constraint));
    let constraintTypeStr = (0, _util.toUpper)(constraintType);
    if (database.toLowerCase() === 'sqlite' && constraintTypeStr === 'UNIQUE KEY') constraintTypeStr = 'UNIQUE';
    constraintSQL.push(constraintTypeStr);
    constraintSQL.push(database.toLowerCase() !== 'sqlite' && (0, _util.identifierToSql)(index));
    constraintSQL.push(...(0, _indexDefinition.indexTypeAndOptionToSQL)(constraintDefinition));
    constraintSQL.push(...(0, _column.columnReferenceDefinitionToSQL)(referenceDefinition));
    constraintSQL.push((0, _util.toUpper)(enforced));
    constraintSQL.push((0, _util.commonOptionConnector)('FOR', _util.identifierToSql, forColumn));
    constraintSQL.push((0, _util.literalToSQL)(withValues));
    return constraintSQL.filter(_util.hasVal).join(' ');
  }
});