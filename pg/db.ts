import { p, something } from "base/base.ts"
import { Log } from "base/log.ts"
import { PgUrl, parsePgUrl } from "./utils.ts"
import * as bash from "base/bash.ts"
import { Pool, PoolClient } from "postgres/mod.ts"

// Hiding notice warnings, should be removed when issue fixed
// https://github.com/denodrivers/postgres/issues/254
import { parseNotice } from "postgres/connection/warning.ts"
import { Connection } from "postgres/connection/connection.ts"

(Connection.prototype as something).processNotice = function(msg: something): something {
  return parseNotice(msg)
}


// Db ----------------------------------------------------------------------------------------------
export class Db {
  private          pool?: Pool
  private readonly log:   Log
  public  readonly url:   PgUrl

  private          before_callbacks_applied = false
  private readonly before_callbacks:          (() => Promise<void>)[] = []

  constructor(
    public readonly nameOrUrl: string,
    public readonly poolSize:  number = 10
  ) {
    this.url = parsePgUrl(nameOrUrl)
    this.log = new Log("Db", this.url.name)
  }

  async create(): Promise<void> {
    this.log.info("create")
    const { code, stderr } = await bash.run(["createdb", "-U", this.url.user, this.url.name])
    if (code != 0 && !stderr.includes(`database "${this.url.name}" already exists`)) {
      throw new Error(`can't create database ${this.url.user} ${this.url.name}`)
    }
  }

  async drop(): Promise<void> {
    this.log.info("drop")
    const { code, stderr } = await bash.run(["dropdb", "-U", this.url.user, this.url.name])
    if (code != 0 && !stderr.includes(`database "${this.url.name}" does not exist`)) {
      throw new Error(`can't drop database ${this.url.user} ${this.url.name}`)
    }
  }

  async close(): Promise<void> {
    if (!this.pool) return
    this.log.error("close")
    const pool = this.pool
    try { await pool?.end() } catch {}
  }

  async withConnection<T>(op: (conn: PoolClient) => Promise<T>): Promise<T> {
    let conn: PoolClient | undefined = undefined
    const pool = this.getPool()
    try {
      conn = await pool.connect()
      const result = await op(conn)
      await conn?.release()
      return result
    } catch(e) {
      this.log.with(e).error("can't execute, reconnecting")
      if (this.pool == pool) this.pool = undefined
      try { await pool.end() } catch {}
      throw e
    }
  }


  async withConnection<T>(op: (conn: PoolClient) => Promise<T>): Promise<T> {
    let conn: PoolClient | undefined = undefined
    const pool = this.getPool()
    try {
      conn = await pool.connect()
      const result = await op(conn)
      await conn?.release()
      return result
    } catch(e) {
      this.log.with(e).error("can't execute, reconnecting")
      if (this.pool == pool) this.pool = undefined
      try { await pool.end() } catch {}
      throw e
    }
  }

  async exec<T = unknown[]>(sql: string, params: something[], log: (log: Log) => void): Promise<T[]>
  async exec<T = unknown[]>(sql: string, log: (log: Log) => void): Promise<T[]>
  async exec<T = unknown[]>(
    sql: string,
    paramsOrLog: (something[] | ((log: Log) => void)) = [],
    log3: ((log: Log) => void) = (log) => log.info("exec")
  ): Promise<T[]> {
    let params: something[] = paramsOrLog instanceof Function ? [] : paramsOrLog
    let log: ((log: Log) => void) = paramsOrLog instanceof Function ? paramsOrLog : log3

    log(this.log)

    if (params.length == 0) {
      let { rows } = await this.withConnection((conn) => conn.queryArray(sql))
      return (rows as something)
    } else {
      let { rows } = await this.withConnection((conn) => conn.queryArray({ text: sql, args: params }))
      return (rows as something)
    }
  }

  private getPool() {
    if (this.pool == undefined) {
      this.log.info("connect")
      this.pool = new Pool({
        hostname: this.url.host,
        port:     this.url.port,
        user:     this.url.user,
        password: this.url.password,
        database: this.url.name
      }, this.poolSize, true)
    }
    return this.pool
  }
}






// Test --------------------------------------------------------------------------------------------
// deno run --import-map=import_map.json --unstable --allow-net --allow-run pg/db.ts
if (import.meta.main) {
  const db = new Db("deno_test")
  await db.create()
  // await db.exec(create_files_schema, (log) => log.info("creating files schema"))

  // const files = new Files("./tmp/files_test", db)

  // function tou8a(s: string) { return new TextEncoder().encode(s) }

  // await files.setFile("alex", "plot", "/index.html", crypto.hash("some html", 'sha256'), tou8a("some html"))
  // await files.setFile("alex", "plot", "/scripts/script.js", crypto.hash("some js", 'sha256'), tou8a("some js"))

  // assert.equal(await files.getFile("alex", "plot", "/index.html"), tou8a("some html"))
  // assert.equal(await files.getFile("alex", "plot", "/scripts/script.js"), tou8a("some js"))

  // await files.delFile("alex", "plot", "/scripts/script.js")
  // let found: string
  // try {
  //   await files.getFile("alex", "plot", "/scripts/script.js")
  //   found = "found"
  // } catch {
  //   found = "not found"
  // }
  // assert.equal(found, "not found")

  // assert.equal((await files.getFiles("alex", "plot")).map((f) => f.path), ["/index.html"])
}