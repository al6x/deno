import { p, something, assert, keys, test } from "base/base.ts"
import { Log } from "base/log.ts"
import { PgUrl, parsePgUrl, postProcessRow } from "./utils.ts"
import { sql, SQL, sqlToString } from "./sql.ts"
import * as bash from "base/bash.ts"
import { Pool, PoolClient } from "postgres/mod.ts"
import { DbTable } from "./db_table.ts"

// Hiding notice warnings, should be removed when issue fixed
// https://github.com/denodrivers/postgres/issues/254
import { parseNotice } from "postgres/connection/warning.ts"
import { Connection } from "postgres/connection/connection.ts"

(Connection.prototype as something).processNotice = function(msg: something): something {
  return parseNotice(msg)
}

export { sql }
export type { SQL }

// Db ----------------------------------------------------------------------------------------------
export class Db {
  private          pool?: Pool
  private readonly log:   Log
  public  readonly url:   PgUrl

  private readonly beforecallbacks: SQL[] = []

  constructor(
    public readonly id:                  string,
    public readonly nameOrUrl:           string,
    public readonly createDbIfNotExist = true,
    public readonly poolSize           = 10
  ) {
    this.url = parsePgUrl(nameOrUrl)
    this.log = new Log("Db", this.id)
  }

  private static readonly dbs = new Map<string, Db>()
  static instance(id = "default"): Db {
    let db = this.dbs.get(id)
    if (!db) throw new Error(`can't find db instance ${id}`)
    return db
  }
  static instantiate(db: Db, override = false): void {
    if (this.dbs.has(db.id) && !override) throw new Error(`can't re define db instance ${db.id}`)
    this.dbs.set(db.id, db)
  }

  table<T extends object>(name: string, ids = ["id"], auto_id = false): DbTable<T> {
    return new DbTable<T>(this, name, ids, auto_id)
  }

  async create() {
    this.log.info("create")
    const { code, stderr } = await bash.run(["createdb", "-U", this.url.user, this.url.name])
    if (code != 0 && !stderr.includes(`database "${this.url.name}" already exists`)) {
      throw new Error(`can't create database ${this.url.user} ${this.url.name}`)
    }
  }

  async drop() {
    this.log.info("drop")
    const { code, stderr } = await bash.run(["dropdb", "-U", this.url.user, this.url.name])
    if (code != 0 && !stderr.includes(`database "${this.url.name}" does not exist`)) {
      throw new Error(`can't drop database ${this.url.user} ${this.url.name}`)
    }
  }

  async close() {
    if (!this.pool) return
    this.log.error("close")
    const pool = this.pool
    try { await pool?.end() } catch {}
  }

  before(sql: SQL, prepend = false) {
    if (this.prepared) throw new Error("too late, before callbacks already applied")
    if (prepend) this.beforecallbacks.unshift(sql)
    else         this.beforecallbacks.push(sql)
  }

  private async prepareSequential() {
    // Auto creating database if needed
    assert(this.pool == undefined, "pool can't be defined at this stage")
    let pool = this.createPool()
    try {
      let conn = await pool.connect()
      await conn.queryObject("select 1")
      await conn.release()
    } catch(e) {
      try { await pool.end() } catch {}

      if ((e.message || "").includes(`database "${this.url.name}" does not exist`) && this.createDbIfNotExist) {
        await this.create()
        pool = this.createPool()
      } else {
        throw e
      }
    }

    // Applying callbacks
    this.log.info("applying before callbacks")
    try {
      let conn = await pool.connect()
      for (const sql of this.beforecallbacks) {
        await conn.queryObject(sql.sql, ...sql.values)
      }
      this.log.info("before callbacks applied")
      await conn.release()
      this.pool = pool
    } catch(e) {
      this.log.with(e).error("can't apply before callbacks, reconnecting")
      try { await pool.end() } catch {}
      throw e
    }
  }

  private prepared = false
  private prepareInProgress?: Promise<void>
  private async prepare() {
    // Applying before callbacks
    if (this.prepared)          return
    if (this.prepareInProgress) return this.prepareInProgress

    try {
      this.prepareInProgress = this.prepareSequential()
      await this.prepareInProgress
      this.prepared = true
    } finally {
      this.prepareInProgress = undefined
    }
  }

  private async withConnection<T>(op: (conn: PoolClient) => Promise<T>): Promise<T> {
    await this.prepare()
    let conn: PoolClient | undefined = undefined
    this.pool == this.pool || this.createPool()
    const pool = this.pool!
    try {
      conn = await pool.connect()
      const result = await op(conn)
      await conn.release()
      return result
    } catch(e) {
      this.log.with(e).error("can't execute, reconnecting")
      if (this.pool == pool) this.pool = undefined
      try { await pool.end() } catch {}
      throw e
    }
  }

  private defaultLog(sql: SQL, message: string) {
    return (log: Log) => { log.with({ sql: sqlToString(sql) }).info(`${message} '{sql}'`) }
  }

  async exec(sql: SQL, log?: (log: Log) => void): Promise<void> {
    await this.withConnection(async (conn) => {
      (log || this.defaultLog(sql, "exec"))(this.log)
      await conn.queryObject(sql.sql, ...sql.values)
      return "nothing"
    })
  }

  async get<T>(sql: SQL, log?: (log: Log) => void): Promise<T[]> {
    let { rows } = await this.withConnection((conn) => {
      (log || this.defaultLog(sql, "get"))(this.log)
      return conn.queryObject(sql.sql, ...sql.values)
    })
    return rows.map(postProcessRow) as T[]
  }

  async fget<T>(sql: SQL, log?: (log: Log) => void): Promise<T | undefined> {
    let rows = await this.get<T>(sql, log || this.defaultLog(sql, "fget"))
    if (rows.length > 1) throw new Error(`expected single result but got ${rows.length} rows`)
    if (rows.length < 1) return undefined
    return rows[0]
  }

  async getOne<T>(sql: SQL, log?: (log: Log) => void): Promise<T> {
    let rows = await this.get<T>(sql, log || this.defaultLog(sql, "getOne"))
    if (rows.length > 1) throw new Error(`expected single row but got ${rows.length} rows`)
    if (rows.length < 1) throw new Error(`expected single row but got none`)
    return rows[0]
  }

  async getValue<T extends number | string | boolean>(sql: SQL, log?: (log: Log) => void): Promise<T> {
    let rows = await this.get(sql, log || this.defaultLog(sql, "getOne"))
    if (rows.length > 1) throw new Error(`expected single row but got ${rows.length} rows`)
    if (rows.length < 1) throw new Error(`expected single row but got none`)
    let row = rows[0]

    let allKeys = Object.keys(row as object)
    if (allKeys.length > 1) throw new Error(`expected single value in row but got ${allKeys.length} columns`)
    if (allKeys.length < 1) throw new Error(`expected single value in row but got nothing`)
    return (row as something)[allKeys[0]]
  }

  private createPool(): Pool {
    this.log.info("connect")
    return new Pool({
      hostname: this.url.host,
      port:     this.url.port,
      user:     this.url.user,
      password: this.url.password,
      database: this.url.name
    }, this.poolSize, true)
  }
}


// Test --------------------------------------------------------------------------------------------
// test=slow deno run --import-map=import_map.json --unstable --allow-all db/db.ts
test("Db", async () => {
  // Configuration should be done in separate runtime config
  Db.instantiate(new Db("default", "deno_unit_tests"), true)

  // Will be connected lazily and reconnected in case of connection error
  const db = Db.instance()

  // Executing schema befor any other DB query, will be executed lazily before the first use
  db.before(sql`
    drop table if exists users;

    create table users(
      name varchar(100) not null,
      age  integer      not null
    );
  `)

  await db.exec(sql`insert into users (name, age) values (${"Jim"}, ${30})`)

  assert.equal(
    await db.get(sql`select name, age from users order by name`),
    [{ name: "Jim", age: 30 }]
  )

  // Count
  assert.equal(
    await db.getValue<number>(sql`select count(*) from users where age = ${30}`), 1
  )
}, true)