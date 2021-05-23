import { assert, p, test, something } from "base/base.ts"
import { formatTime } from "base/time.ts"

export function decode<T extends object>(row: T): T {
  const o: something = {}
  for (const k in row) {
    const v = row[k]

    // Converting BitInt to Number
    if (typeof v == "bigint") {
      const n = Number(v)
      if ((n as something) != (v as something)) throw new Error(`can't convert BigInt to Number, ${v}`)
      o[k] = n
    } else {
      o[k] = v
    }

    // Fixing time zone for date

  }
  return o
}

export function encode(values: unknown[]): unknown[] {
  return values.map((v) => {
    if (typeof v == "object") {
      if (v instanceof Date) {
        // Encoding Date as GMT string, with resolutions for seconds only
        return formatTime(v.valueOf())
      }
    }
    return v
  })
}

// PgUrl ------------------------------------------------------------------------------------------
export interface PgUrl {
  readonly url:      string
  readonly host:     string
  readonly port:     number
  readonly name:     string
  readonly user:     string
  readonly password: string
}

export function parsePgUrl(name_or_url: string): PgUrl {
  const url = name_or_url.includes(":") ? name_or_url : `postgresql://postgres@localhost:5432/${name_or_url}`
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

