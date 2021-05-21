import { p, something } from "base/base.ts"
import { Log } from "base/log.ts"
import { Client, Pool, PoolClient } from "postgres/mod.ts"

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

  constructor(
    public readonly nameOrUrl: string,
    public readonly poolSize:  number = 10
  ) {
    this.url = parsePgUrl(nameOrUrl)
    this.log = new Log("Db", this.url.name)
  }

  // async connect(): Promise<void> {
  //   await this.pool.connect()
  // }

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

  async exec<T = unknown[]>(sql: string, params: something[] = []): Promise<T[]> {
    this.log.with({ sql: sql }).info("exec")
    let conn: PoolClient | undefined = undefined
    let pool = this.getPool()
    try {
      conn = await pool.connect()
      if (params.length == 0) {
        let { rows } = await conn.queryArray(sql)
        return (rows as something)
      } else {
        let { rows } = await conn.queryArray({ text: sql, args: params })
        return (rows as something)
      }
    } catch(e) {
      this.log.with({ sql: sql }).with(e).error("can't execute, quitting")
      // Terminating pool on any error, it will be re-connected on demand
      this.log.info("disconnect")
      if (this.pool == pool) this.pool = undefined
      try   { await pool.end() }
      catch {}
      throw e
    } finally {
      await conn?.release()
    }
  }
}


// PgUrl ------------------------------------------------------------------------------------------
interface PgUrl {
  readonly url:      string
  readonly host:     string
  readonly port:     number
  readonly name:     string
  readonly user:     string
  readonly password: string
}

function parsePgUrl(name_or_url: string): PgUrl {
  const url = name_or_url.indexOf(":") >= 0 ? name_or_url : `postgresql://postgres@localhost:5432/${name_or_url}`
  let parsed = new URL(url)
  return {
    url,
    host:     parsed.hostname,
    port:     parseInt(parsed.port),
    name:     parsed.pathname.replace(/^\//, ""),
    user:     parsed.username,
    password: parsed.username
  }
}