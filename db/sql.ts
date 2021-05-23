import { p, assert, test, something, trim, sort } from "base/base.ts"
import { formatTime } from "base/time.ts"

export type SQLValue = object | null | string | number | boolean | Date
export type SQL = { sql: string, values: SQLValue[] }

export function sqlToString(sql: SQL) {
  return trim(sql.sql.replace(/[\n\s]+/g, " ")) +
    (sql.values.length > 0 ? ` <- ${sql.values.map(sqlValueToString).join(", ")}` : "")
}

function isSql(o: something): o is SQL {
  return o != null && o != undefined && typeof o == "object" && "sql" in o && "values" in o
}

// sql ---------------------------------------------------------------------------------------------
function sql(literals: TemplateStringsArray, ...values: SQLValue[]): SQL
function sql(sql: string): SQL
function sql(sql: string, values: object): SQL
function sql(sql: string, values: object, validateUnusedKeys: boolean): SQL
function sql(...args: something[]): SQL {
  let fn = Array.isArray(args[0]) ? sqlLiteral : sqlParams
  return (fn as something).apply(null, args)
}
export { sql }


// sqlLiteral --------------------------------------------------------------------------------------
function sqlLiteral(literals: TemplateStringsArray, ...placeholders: SQLValue[]): SQL {
  let sql: string[] = [], values: SQLValue[] = []
  let counter = 1
  for (let i = 0; i < literals.length; i++) {
    sql.push(literals[i])
    if (i < placeholders.length) {
      let placeholder = placeholders[i]
      if (Array.isArray(placeholder)) {
        assert(placeholder.length > 0, 'empty SQL array')
        sql.push('(')
        for (let item of placeholder) {
          if (Array.isArray(item)) {
            sql.push('(')
            for (let itemI of item) {
              sql.push(`$${counter++}`)
              sql.push(', ')
              values.push(itemI)
            }
            sql.pop()
            sql.push(')')
            sql.push(', ')
          } else {
            sql.push(`$${counter++}`)
            sql.push(', ')
            values.push(item)
          }
        }
        sql.pop()
        sql.push(')')
      } else {
        sql.push(`$${counter++}`)
        values.push(placeholder)
      }
    }
  }
  return { sql: sql.join(''), values }
}

test("sqlLiteral", () => {
  assert.equal(
    sql`insert into users (name, age) values (${"Jim"}, ${33})`,
    { sql: "insert into users (name, age) values ($1, $2)", values: ["Jim", 33] }
  )

  // Should expand list
  assert.equal(
    sql`select count(*) from users where name in ${["Jim", "John", null]}`,
    { sql: "select count(*) from users where name in ($1, $2, $3)", values: ["Jim", "John", null] }
  )
})


// sqlParams ---------------------------------------------------------------------------------------
export function sqlParams(sql: string, values = {}, validateUnusedKeys = true): SQL {
  // Replacing SQL parameters
  let sqlKeys = new Set<string>(), orderedValues: SQLValue[] = []
  let counter = 0
  let replacedSql = sql.replace(/(:[a-z0-9_]+)/g, (_match, capture) => {
    let key = capture.replace(":", "")
    sqlKeys.add(key)
    if (!(key in values)) throw new Error(`no SQL param :${key}`)
    let value = (values as something)[key]
    if (Array.isArray(value)) {
      let item: something, placeholders: string[] = []
      for (item of value) {
        orderedValues.push(item)
        counter = counter + 1
        placeholders.push(`$${counter}`)
      }
      return '(' + placeholders.join(', ') + ')'
    } else {
      orderedValues.push(value)
      counter = counter + 1
      return `$${counter}`
    }
  })

  // Ensuring there's no unused keys
  if (validateUnusedKeys) {
    for (const k in values) {
      if (values.hasOwnProperty(k) && !sqlKeys.has(k)) throw new Error(`SQL param :${k} is not used`)
    }
  }

  return { sql: replacedSql, values: orderedValues }
}


test("sqlParams", () => {
  assert.equal(
    sql("insert into users (name, age) values (:name, :age)", { name: "Jim", age: 33 }),
    { sql: "insert into users (name, age) values ($1, $2)", values: ["Jim", 33] }
  )

  // Should expand list
  assert.equal(
    sql("select count(*) from users where name in :users", { users: ["Jim", "John", null] }),
    { sql: "select count(*) from users where name in ($1, $2, $3)", values: ["Jim", "John", null] }
  )
})


// buildWhere --------------------------------------------------------------------------------------
export function buildWhere<W>(where: W, ids: string[]): SQL {
  if (isSql(where)) {
    return where
  } else if (typeof where == "object") {
    // Checkingif where is object of T, then using only its ids, used to delete or refresh object of T
    let isT = ids.length > 0
    for (const id of ids) if (!(id in where)) isT = false

    let fields = isT ? Object.keys(where).filter((n) => ids.includes(n)) : Object.keys(where)
    const conditions = sort(fields).map((name) => `${name} = :${name}`).join(" and ")
    return sql(conditions, where as something, !isT)
  } else if (typeof where == "number" || typeof where == "string" || typeof where == "boolean") {
    return sql`id = ${where}`
  } else {
    throw `unsupported where clause {where}`
  }
}

function sqlValueToString(v: SQLValue): string {
  if (typeof v == "object" && v instanceof Date) return formatTime(v)
  return "" + v
}

test("buildQuery", () => {
  assert.equal(buildWhere(sql`id = ${1}`, []), sql`id = ${1}`)

  assert.equal(buildWhere({ id: 1 }, []), sql`id = ${1}`)

  assert.equal(buildWhere(1, []), sql`id = ${1}`)

  assert.equal(buildWhere({ name: "Jim", id: 1 }, []),     sql`id = ${1} and name = ${"Jim"}`)
  assert.equal(buildWhere({ name: "Jim", id: 1 }, ["id"]), sql`id = ${1}`)
})


// Test --------------------------------------------------------------------------------------------
// test=true deno run --import-map=import_map.json --allow-env db/sql.ts