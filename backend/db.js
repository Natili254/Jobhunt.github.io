const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env"), override: true });
const { Pool } = require("pg");

const explicitSsl = String(process.env.DB_SSL || "").toLowerCase();
const sslEnabled = process.env.DATABASE_URL
    ? explicitSsl !== "false"
    : explicitSsl === "true";
const pool = process.env.DATABASE_URL
    ? new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
    })
    : new Pool({
        host: process.env.DB_HOST || process.env.PGHOST || "localhost",
        port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
        user: process.env.DB_USER || process.env.PGUSER,
        password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
        database: process.env.DB_NAME || process.env.PGDATABASE,
        ssl: sslEnabled ? { rejectUnauthorized: false } : false
    });

function toPgPlaceholders(sql) {
    let i = 0;
    return sql.replace(/\?/g, () => `$${++i}`);
}

function normalizeInsertReturning(sql) {
    const trimmed = sql.trim();
    if (!/^insert\s+/i.test(trimmed)) return sql;
    if (/\sreturning\s+/i.test(trimmed)) return sql;
    return `${trimmed} RETURNING id`;
}

function mapMySqlShowColumns(sql, params) {
    const match = sql.match(/^SHOW\s+COLUMNS\s+FROM\s+([a-zA-Z0-9_]+)\s+LIKE\s+\?/i);
    if (!match) return null;
    const table = match[1];
    const column = params?.[0];
    return {
        sql: "SELECT column_name AS Field FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2",
        params: [table, column],
        mode: "columns_check"
    };
}

function query(sql, params, callback) {
    const cb = typeof params === "function" ? params : callback;
    const values = Array.isArray(params) ? params : [];

    const mapped = mapMySqlShowColumns(sql, values);
    const finalSql = mapped ? mapped.sql : normalizeInsertReturning(toPgPlaceholders(sql));
    const finalParams = mapped ? mapped.params : values;

    pool.query(finalSql, finalParams)
        .then((result) => {
            if (mapped?.mode === "columns_check") {
                cb?.(null, result.rows);
                return;
            }

            const isInsert = /^\s*insert\s+/i.test(sql);
            if (isInsert) {
                cb?.(null, {
                    insertId: result.rows?.[0]?.id ?? null,
                    affectedRows: result.rowCount,
                    rows: result.rows
                });
                return;
            }
            cb?.(null, result.rows);
        })
        .catch((err) => cb?.(err));
}

function getConnection(callback) {
    pool.connect()
        .then((client) => {
            callback(null, {
                query: (sql, params, cb) => {
                    if (typeof params === "function") {
                        cb = params;
                        params = [];
                    }
                    const values = Array.isArray(params) ? params : [];
                    const finalSql = toPgPlaceholders(sql);
                    client.query(finalSql, values)
                        .then((result) => cb?.(null, result.rows))
                        .catch((err) => cb?.(err));
                },
                release: () => client.release()
            });
        })
        .catch((err) => callback(err));
}

getConnection((err, connection) => {
    if (err) {
        console.error("PostgreSQL Connection Error:", err.message);
        console.error("The server will continue running but DB queries will fail until the database is reachable.");
        return;
    }
    connection.query("SELECT 1", (qErr) => {
        if (qErr) {
            console.error("PostgreSQL test query error:", qErr.message);
        } else {
            console.log("PostgreSQL Connected");
        }
        connection.release();
    });
});

module.exports = { query, getConnection };





