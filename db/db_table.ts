import { p, something, assert, ensure, slowTest } from "base/base.ts"
import { Log } from "base/log.ts"
import { sql, SQL, sqlToString, buildWhere, Where } from "./sql.ts"
import { Db } from "./db.ts"

export type { SQL }
export { Db, sql }

export class DbTable<T extends object> {
  private readonly log:   Log

  constructor(
    public readonly db:   Db,
    public readonly name: string,
    public readonly ids:  string[],
    public readonly auto_id: boolean
  ) {
    this.log = new Log(db.id || "db").with(this.name)
  }

  // Could be overrided
  columnNames(o: T): string[] { return Object.keys(o) }

  // Could be overrided
  postInit = (o: T): T => { return o }

  async create(o: T): Promise<T> {
    this.log.info("create")
    if (this.ids.length == 0) {
      const columnNames = this.columnNames(o)
      const names = " " + columnNames.join(",  ")
      const values = columnNames.map((n) => `:${n}`).join(", ")
      const query =`
        insert into ${this.name}
          (${names})
        values
          (${values})
      `
      await this.db.exec(sql(query, o, false), () => {})
      return o
    } else {
      const columnNames = this.auto_id
        ? this.columnNames(o).filter((n) => !this.ids.includes(n))
        : this.columnNames(o)
      const names = " " + columnNames.join(",  ")
      const values = columnNames.map((n) => `:${n}`).join(", ")
      const ids = this.ids.join(", ")
      const query = `
        insert into ${this.name}
          (${names})
        values
          (${values})
        returning ${ids}
      `

      const idsFromDatabase = await this.db.get(sql(query, o, false), () => {}) as object
      return { ...o, ...idsFromDatabase }
    }
  }

  async update(o: T): Promise<void> {
    if (this.ids.length == 0) throw new Error("can't update object without id")
    this.log.info("update")
    const setters = this.columnNames(o)
      .filter((n) => !this.ids.includes(n)).map((n) => `${n} = :${n}`).join(", ")
    const where = this.ids.map((n) => `${n} = :${n}`).join(" and ")
    const query = `
      update ${this.name}
      set
        ${setters}
      where ${where}
    `
    await this.db.exec(sql(query, o), () => {})
  }


  async save(o: T): Promise<T> {
    if (this.ids.length == 0) throw new Error("can't update object without id")
    this.log.info("save")

    const columnNames = this.auto_id
        ? this.columnNames(o).filter((n) => !this.ids.includes(n))
        : this.columnNames(o)
    const ids = this.ids.join(", ")
    const insertColumns = " " + columnNames.join(",  ")
    const insertValues  = columnNames.map((n) => `:${n}`).join(", ")
    const setters = columnNames.map((n) => `${n} = excluded.${n}`).join(", ")
    const query = `
      insert into ${this.name}
        (${insertColumns})
      values
        (${insertValues})
      on conflict (${ids}) do update
      set
        ${setters}
      returning ${ids}
    `

    const idsFromDatabase = await this.db.get(sql(query, o, false), () => {}) as object
    return { ...o, ...idsFromDatabase }
  }


  async filter(where?: Where<T>, limit = 0, log?: (log: Log) => void): Promise<T[]> {
    const whereSql = buildWhere<T>(where || sql``, this.ids)
    // let defaultLog = (log: Log) => log.with({ where: sqlToString(whereSql) }).info("filter '{where}'")
    ;(log || defaultWhereLog(whereSql, "filter"))(this.log)

    const whereStatement = whereSql.sql == "" ? "" : " where "
    const limitStatement = limit > 0 ? ` limit ${limit}` : ""
    var query = `select * from ${this.name}${whereStatement}${whereSql.sql}${limitStatement}`
    return (await this.db.filter<T>({ sql: query, values: whereSql.values }, () => {})).map(this.postInit)
  }


  async fget(where?: Where<T>, log?: (log: Log) => void): Promise<T | undefined> {
    const whereSql = buildWhere<T>(where || sql``, this.ids)
    // let defaultLog = (log: Log) => log.with({ where: sqlToString(whereSql) }).info("get_one '{where}'")
    ;(log || defaultWhereLog(whereSql, "get"))(this.log)
    const found = await this.filter(where, 2, () => {})
    if (found.length > 1) throw new Error(`expected one but found ${found.length} objects`)
    return found.length > 0 ? found[0] : undefined
  }


  async del(where?: Where<T>, log?: (log: Log) => void): Promise<void> {
    const whereSql = buildWhere<T>(where || sql``, this.ids)
    // let defaultLog = (log: Log) => log.with({ where: sqlToString(whereSql) }).info("del '{where}'")
    ;(log || defaultWhereLog(whereSql, "del"))(this.log)
    const query = `delete from ${this.name} where ${whereSql.sql}`
    await this.db.exec({ sql: query, values: whereSql.values }, () => {})
  }


  delAll(): Promise<void> {
    this.log.info("delAll")
    return this.db.exec(sql`delete from ${this.name}`, () => {})
  }


  count(where?: Where<T>, log?: (log: Log) => void): Promise<number> {
    const whereSql = buildWhere<T>(where || sql``, this.ids)
    // let defaultLog = (log: Log) => log.with({ where: sqlToString(whereSql) }).info("count '{where}'")
    ;(log || defaultWhereLog(whereSql, "count"))(this.log)

    const whereStatement = whereSql.sql == "" ? "" : " where "
    var query = `select count(*) from ${this.name}${whereStatement}${whereSql.sql}`
    return this.db.getValue({ sql: query, values: whereSql.values }, () => {})
  }


  async has(where?: Where<T>, log?: (log: Log) => void): Promise<boolean> {
    const whereSql = buildWhere<T>(where || sql``, this.ids)
    // let defaultLog = (log: Log) => log.with({ where: sqlToString(whereSql) }).info("contains '{where}'")
    ;(log || defaultWhereLog(whereSql, "has"))(this.log)

    return await this.count(where, () => {}) > 0
  }


  async get<W>(where: W, log?: (log: Log) => void): Promise<T> {
    return ensure(await this.fget(where, log))
  }
}

function defaultWhereLog(sql: SQL, msg: string): (log: Log) => void {
  return (log: Log) => log.with({ where: sqlToString(sql) }).info(`${msg} '{where}'`)
}

// Test --------------------------------------------------------------------------------------------
// test=DbTable deno run --import-map=import_map.json --unstable --allow-all db/db_table.ts
slowTest("DbTable", async () => {
  // Will connect lazily and reconnected in case of connection error
  const db = new Db("deno_unit_tests")

  // Before will be executed lazily, before the first query
  db.before(sql`
    drop table if exists users;

    create table users(
      id   integer      not null,
      name varchar(100) not null,
      age  integer      not null,

      primary key (id)
    );
  `, "creating schema")

  // Defining User Model
  interface User {
    id:   number
    name: string
    age:  number
  }

  const users = db.table<User>("users")

  // Saving
  var jim: User = { id: 1, name: "Jim", age: 30 }
  await users.create(jim) // jim.id going to be updated by database

  await users.save(jim)

  jim.age = 31
  await users.save(jim)

  // refresh
  assert.equal(await users.get(jim), jim)

  // filter
  assert.equal(await users.filter(sql`age = ${31}`), [jim])
  assert.equal(await users.filter({ age: 31 }),      [jim])
  assert.equal(await users.filter(1),                [jim])

  // []
  assert.equal(await users.get(sql`age = ${31}`), jim)
  assert.equal(await users.get({ age: 31 }),      jim)
  assert.equal(await users.get(1),                jim)

  // count, has
  assert.equal(await users.count({ age: 31 }), 1)
  assert.equal(await users.has({ age: 31 }), true)

  // del
  await users.del(jim)
  assert.equal(await users.count(), 0)

  await db.close()
})