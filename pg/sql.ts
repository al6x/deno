import { p, assert, test, something, trim } from "base/base.ts"

export type SQLValue = object | null | string | number | boolean
export type SQL = { sql: string, values: SQLValue[] }

export function sqlToString(sql: SQL) {
  return trim(sql.sql.replace(/[\n\s]+/g, " ")) + (sql.values.length > 0 ? ` <- ${sql.values.join(", ")}` : "")
}

function sql(literals: TemplateStringsArray, ...values: SQLValue[]): SQL
function sql(sql: string, values: object): SQL
function sql(sql: string, values: object, validateUnusedKeys: boolean): SQL
function sql(...args: something[]): SQL {
  let fn = Array.isArray(args[0]) ? sqlLiteral : sqlParams
  return (fn as something).apply(null, args)
}
export { sql }

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
    ["insert into users (name, age) values ($1, $2)", ["Jim", 33]]
  )

  // Should expand list
  assert.equal(
    sql`select count(*) from users where name in ${["Jim", "John", null]}`,
    ["select count(*) from users where name in ($1, $2, $3)", ["Jim", "John", null]]
  )
})


export function sqlParams(sql: string, values: object, validateUnusedKeys = true): SQL {
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
    ["insert into users (name, age) values ($1, $2)", ["Jim", 33]]
  )

  // Should expand list
  assert.equal(
    sql("select count(*) from users where name in :users", { users: ["Jim", "John", null] }),
    ["select count(*) from users where name in ($1, $2, $3)", ["Jim", "John", null]]
  )
})

// test=true deno run --import-map=import_map.json --allow-env pg/sql.ts