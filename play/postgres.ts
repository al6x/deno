// Docs https://deno-postgres.com
//
// deno run --import-map=import_map.json --allow-net play.ts

import { p } from "base/base.ts"
import { Client, Pool } from "postgres/mod.ts"

const pool = new Pool({
  hostname: "localhost",
  port:     5432,
  user:     "postgres",
  password: "",
  database: "nim_test"
}, 10, true)

const client = await pool.connect()
await client.queryArray`SELECT 1`
await client.release()