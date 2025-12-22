import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const sqlFile = path.resolve("sql/schema.sql");
const schema = fs.readFileSync(sqlFile, "utf8");

const sql = postgres(connectionString, {
  ssl: "require",
  max: 1,
  prepare: false,
});

try {
  await sql.unsafe(schema);
  console.log("Schema applied successfully.");
} finally {
  await sql.end();
}
