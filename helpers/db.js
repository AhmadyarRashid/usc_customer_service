const mysql = require("mysql");
const config = require("../config/config");

// create db pool based on config
const pool = mysql.createPool({
  connectionLimit: config.db_poolsize,
  host: config.db_host,
  port: config.db_port,
  user: config.db_user,
  password: config.db_pass,
  database: config.db_name
});

// return promise with connection from db pool
const getDBConnection = () => {
  return new Promise((resolve, reject) => {
    pool.getConnection((err, connection) => {
      if (err) reject(err);
      else if (connection) resolve(connection);
      else reject("error getting connection to db");
    });
  });
};

// execute query and return promise with rows
const executeQuery = (query, args) => {
  return new Promise((resolve, reject) => {
    getDBConnection()
      .then(connection => {
        connection.query(query, args, (err, rows) => {
          connection.release();
          if (err) reject(err);
          else resolve(rows);
        });
      })
      .catch(err => {
        console.log("Exception occured in db.js at executeQuery function:");
        console.log(err);
        reject(err);
      });
  });
};

const executeConnectedQuery = (conn, query, args) => {
  return new Promise((resolve, reject) => {
    conn.query(query, args, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = { pool, executeQuery, getDBConnection, executeConnectedQuery };
