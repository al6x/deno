import { p, something, assert, ensure, slowTest } from "base/base.ts"
import { Log } from "base/log.ts"
import { sql, Db } from "./db_table.ts"

export class KVDb {
  private readonly log:     Log
  // private readonly records: DbTable<KVRecord>

  constructor(
    private readonly db: Db,
  ) {
    // this.records = db.table<KVRecord>("kv", ["scope", "key"], false)
    db.before(sql`
      create table if not exists kv(
        scope      varchar(100)   not null,
        key        varchar(100)   not null,
        value      varchar(10000) not null,
        created_at timestamp      not null,
        updated_at timestamp      not null,

        primary key (scope, key)
      );
    `)
    this.log = new Log(db.id || "db", ["kv"])
  }

  fget(scope: string, key: string): Promise<string | undefined> {
    this.log.with({ scope, key }).info("get {scope}/{key}")
    return this.db.fgetValue(sql`select value from kv where scope = ${scope} and key = ${key}`, () => {})
  }

  get(scope: string, key: string): Promise<string | undefined>
  get(scope: string, key: string, dflt: string): Promise<string>
  async get(scope: string, key: string, dflt?: string): Promise<string> {
    return ensure(await this.fget(scope, key) || dflt)
  }

  set(scope: string, key: string, value: string): Promise<void> {
    this.log.with({ scope, key }).info("set {scope}/{key}")

    const now = new Date()
    return this.db.exec(sql`
      insert into kv
        (scope,    key,    value,    created_at,  updated_at)
      values
        (${scope}, ${key}, ${value}, ${now},      ${now})
      on conflict (scope, key) do update
      set
        value = excluded.value, updated_at = excluded.updated_at
    `, () => {})
  }

  del(scope: string, key: string | undefined): Promise<void> {
    if (key != undefined) {
      this.log.with({ scope, key }).info("del {scope}/{key}")
      return this.db.exec(sql`delete from kv where scope = ${scope} and key = ${key}`, () => {})
    } else {
      this.log.with({ scope }).info("del {scope}")
      return this.db.exec(sql`delete from kv where scope = ${scope}`, () => {})
    }
  }

  delAll(): Promise<void> {
    this.log.info("delAll")
    return this.db.exec(sql`delete from kv`, () => {})
  }

  take(scope: string, key: string): Promise<string | undefined>
  take(scope: string, key: string, dflt: string): Promise<string>
  async take(scope: string, key: string, dflt?: string): Promise<string | undefined> {
    const r = await this.fget(scope, key)
    if (r != undefined) await this.del(scope, key)
    return r || dflt
  }
}

// Test --------------------------------------------------------------------------------------------
// test=KVDb deno run --import-map=import_map.json --unstable --allow-all db/kvdb.ts
slowTest("KVDb", async () => {
  const db = new Db("deno_unit_tests")
  const kvdb = new KVDb(db)
  await kvdb.delAll()

  assert.equal(await kvdb.get("test", "a", "none"), "none")
  await kvdb.set("test", "a", "b")
  assert.equal(await kvdb.get("test", "a", "none"), "b")

  assert.equal(await kvdb.take("test", "a", "none"), "b")
  assert.equal(await kvdb.take("test", "a", "none"), "none")

  await db.close()
})