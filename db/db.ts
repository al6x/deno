import "base/base.ts"
import { Log } from "base/log.ts"
import { PgUrl, parsePgUrl, decode, encode } from "./utils.ts"
import { sql, SQL, sqlToString } from "./sql.ts"
import * as bash from "base/bash.ts"
import { Pool, PoolClient } from "postgres/mod.ts"
import { DbTable } from "./db_table.ts"
import { Time } from "base/time.ts"

// Hiding notice warnings, should be removed when issue fixed
// https://github.com/denodrivers/postgres/issues/254
import { parseNotice } from "postgres/connection/warning.ts"
import { Connection } from "postgres/connection/connection.ts"

(Connection.prototype as any).processNotice = function(msg: any): any {
  return parseNotice(msg)
}

export { sql }
export type { SQL }

export type DbValue = number | string | boolean | Date

// Db ----------------------------------------------------------------------------------------------
export class Db {
  private readonly log:                Log
  public  readonly url:                PgUrl
  public  readonly id?:                string
  public  readonly createDbIfNotExist: boolean
  public  readonly poolSize:           number

  private          pool?:           Pool
  private readonly beforecallbacks: [SQL, LogFn][] = []

  constructor(
    public readonly nameOrUrl: string,
    public readonly options?:  { id?: string, createDbIfNotExist?: boolean, poolSize?: number }
  ) {
    this.url                = parsePgUrl(nameOrUrl)
    this.id                 = options?.id
    this.createDbIfNotExist = options?.createDbIfNotExist != false
    this.poolSize           = options?.poolSize || 10
    this.log = new Log(this.id || "db")
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
    this.log.info("close")
    const pool = this.pool
    try { await pool?.end() } catch {}
  }

  before(sql: SQL): void
  before(sql: SQL, log: LogFn): void
  before(sql: SQL, prepend: boolean): void
  before(sql: SQL, log: LogFn, prepend: boolean): void
  before(sql: SQL, arg2?: LogFn | boolean, arg3?: boolean): void {
    const log: LogFn       = typeof arg2 == "boolean" ? undefined : arg2
    const prepend: boolean = typeof arg2 == "boolean" ? arg2 : (
      typeof arg3 == "boolean" ? arg3 : true
    )

    if (this.prepared) throw new Error("too late, before callbacks already applied")
    if (prepend) this.beforecallbacks.unshift([sql, log])
    else         this.beforecallbacks.push([sql, log])
  }

  private async prepareSequential() {
    // Auto creating database if needed
    assert(this.pool == undefined, "internal error, pool can't be defined at this stage")
    let pool = this.createPool()
    try {
      const conn = await pool.connect()
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
    if (this.beforecallbacks.length > 0) {
      this.log.info("applying before callbacks")
      try {
        const conn = await pool.connect()
        for (const [sql, logfn] of this.beforecallbacks) {
          this.log.logfn(logfn)
          await conn.queryObject(sql.sql, ...encode(sql.values))
        }
        // this.log.info("before callbacks applied")
        await conn.release()
        this.pool = pool
      } catch(e) {
        this.log.with(e).error("can't apply before callbacks, reconnecting")
        try { await pool.end() } catch {}
        throw e
      }
    }
  }

  private prepared = false
  private prepareInProgress?: Promise<void>

  // Will be called lazily, also could be called explicitly
  async prepare(): Promise<void> {
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
    this.pool == this.pool || this.createPool()
    const pool = this.pool!
    try {
      const conn = await pool.connect()
      const r = await op(conn)
      await conn.release()
      return r
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

async exec(sql: SQL, log?: LogFn): Promise<void> {
  await this.withConnection(async (conn) => {
    this.log.logfn(log || this.defaultLog(sql, "exec"))
    await conn.queryObject(sql.sql, ...encode(sql.values))
    return "nothing"
  })
}

  async filter<T>(sql: SQL, log?: LogFn): Promise<T[]> {
    const { rows } = await this.withConnection((conn) => {
      this.log.logfn(log || this.defaultLog(sql, "get"))
      const r = conn.queryObject(sql.sql, ...encode(sql.values))
      // r.then(p)
      return r
    })
    return rows.map(decode) as T[]
  }

  async fget<T>(sql: SQL, log?: LogFn): Promise<T | undefined> {
    const rows = await this.filter<T>(sql, log || this.defaultLog(sql, "get"))
    if (rows.length > 1) throw new Error(`expected single result but got ${rows.length} rows`)
    if (rows.length < 1) return undefined
    return rows[0]
  }

  async get<T>(sql: SQL, log?: LogFn): Promise<T> {
    let r = await this.fget<T>(sql, log)
    if (r == undefined) throw new Error(`expected single row but got none`)
    return r
  }

  async fgetValue<T extends DbValue>(sql: SQL, log?: LogFn): Promise<T | undefined> {
    let row = await this.fget<object>(sql, log)
    if (row == undefined) return undefined

    const allKeys = Object.keys(row)
    if (allKeys.length > 1) throw new Error(`expected single value in row but got ${allKeys.length} columns`)
    if (allKeys.length < 1) return undefined
    return (row as any)[allKeys[0]]
  }

  async getValue<T extends DbValue>(sql: SQL, log?: LogFn): Promise<T> {
    let row = await this.get<object>(sql, log)

    const allKeys = Object.keys(row)
    if (allKeys.length > 1) throw new Error(`expected single value in row but got ${allKeys.length} columns`)
    if (allKeys.length < 1) throw new Error(`expected single value in row but got nothing`)
    return (row as any)[allKeys[0]]
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

// Logging -----------------------------------------------------------------------------------------
export type LogFn = ((log: Log) => void) | string | undefined


// Test --------------------------------------------------------------------------------------------
// test=Db deno run --import-map=import_map.json --unstable --allow-all db/db.ts
slow_test("Db", async () => {
  // Will be connected lazily and reconnect in case of connection error
  const db = new Db("deno_unit_tests")

  // Executing schema befor any other DB query, will be executed lazily before the first use
  db.before(sql`
    drop table if exists users;
    create table users(
      name varchar(100) not null,
      age  integer      not null
    );

    drop table if exists times;
    create table times(
      id   varchar(100) not null,
      time timestamp not null
    );
  `)

  // CRUD
  {
    await db.exec(sql`insert into users (name, age) values (${"Jim"}, ${30})`)

    assert.equal(
      await db.filter(sql`select name, age from users order by name`),
      [{ name: "Jim", age: 30 }]
    )

    // Count
    assert.equal(
      await db.getValue<number>(sql`select count(*) from users where age = ${30}`), 1
    )
  }

  // Timezone, should always use GMT
  {
    const now = new Date()
    await db.exec(sql`insert into times (id, time) values ('a', ${now})`)
    await db.exec(sql`insert into times (id, time) values ('b', ${new Time(now)})`)

    const a = await db.getValue<Date>(sql`select time from times where id = 'a'`)
    const b = await db.getValue<Date>(sql`select time from times where id = 'b'`)
    assert(a instanceof Date)
    assert(b instanceof Date)
    assert.equal(new Time(a).to_s(), new Time(b).to_s())
  }

  await db.close()
})