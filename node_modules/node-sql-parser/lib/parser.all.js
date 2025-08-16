(function (global, factory) {
  if (typeof define === "function" && define.amd) {
    define(["exports", "../pegjs/athena.pegjs", "../pegjs/bigquery.pegjs", "../pegjs/db2.pegjs", "../pegjs/flinksql.pegjs", "../pegjs/hive.pegjs", "../pegjs/mysql.pegjs", "../pegjs/mariadb.pegjs", "../pegjs/noql.pegjs", "../pegjs/postgresql.pegjs", "../pegjs/redshift.pegjs", "../pegjs/sqlite.pegjs", "../pegjs/transactsql.pegjs", "../pegjs/snowflake.pegjs", "../pegjs/trino.pegjs"], factory);
  } else if (typeof exports !== "undefined") {
    factory(exports, require("../pegjs/athena.pegjs"), require("../pegjs/bigquery.pegjs"), require("../pegjs/db2.pegjs"), require("../pegjs/flinksql.pegjs"), require("../pegjs/hive.pegjs"), require("../pegjs/mysql.pegjs"), require("../pegjs/mariadb.pegjs"), require("../pegjs/noql.pegjs"), require("../pegjs/postgresql.pegjs"), require("../pegjs/redshift.pegjs"), require("../pegjs/sqlite.pegjs"), require("../pegjs/transactsql.pegjs"), require("../pegjs/snowflake.pegjs"), require("../pegjs/trino.pegjs"));
  } else {
    var mod = {
      exports: {}
    };
    factory(mod.exports, global.athena, global.bigquery, global.db2, global.flinksql, global.hive, global.mysql, global.mariadb, global.noql, global.postgresql, global.redshift, global.sqlite, global.transactsql, global.snowflake, global.trino);
    global.parserAll = mod.exports;
  }
})(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : this, function (_exports, _athena, _bigquery, _db, _flinksql, _hive, _mysql, _mariadb, _noql, _postgresql, _redshift, _sqlite, _transactsql, _snowflake, _trino) {
  "use strict";

  Object.defineProperty(_exports, "__esModule", {
    value: true
  });
  _exports.default = void 0;
  var _default = _exports.default = {
    athena: _athena.parse,
    bigquery: _bigquery.parse,
    db2: _db.parse,
    flinksql: _flinksql.parse,
    hive: _hive.parse,
    mysql: _mysql.parse,
    mariadb: _mariadb.parse,
    noql: _noql.parse,
    postgresql: _postgresql.parse,
    redshift: _redshift.parse,
    snowflake: _snowflake.parse,
    sqlite: _sqlite.parse,
    transactsql: _transactsql.parse,
    trino: _trino.parse
  };
});