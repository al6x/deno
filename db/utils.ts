import "base/base.ts"
import { Time } from "base/time.ts"

export function decode<T extends object>(row: T): T {
  const o: any = {}
  for (const k in row) {
    const v = row[k]

    if (typeof v == "bigint") { // Converting BitInt to Number
      const n = Number(v)
      if ((n as any) != (v as any)) throw new Error(`can't convert BigInt to Number, ${v}`)
      o[k] = n
    } else if (v === null) { // Converting null to undefined
      o[k] = undefined
    } else {
      o[k] = v
    }

  }
  return o
}

export function encode(values: unknown[]): unknown[] {
  return values.map((v) => {
    if (typeof v == "object") {
      if (v instanceof Date) {
        // Encoding Date as GMT string, with resolutions for seconds only
        return new Time(v).to_s()
      } else if (v instanceof Time) {
        return v.to_s()
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
  // Url with `localhost` instead of `127.0.0.1` is not working on linode
  const url = name_or_url.includes(":") ? name_or_url : `postgresql://postgres@127.0.0.1:5432/${name_or_url}`
  let parsed = new URL(url)
  return {
    url,
    host:     parsed.hostname,
    port:     parseInt(parsed.port),
    name:     parsed.pathname.replace(/^\//, ""),
    user:     parsed.username,
    password: parsed.password
  }
}

