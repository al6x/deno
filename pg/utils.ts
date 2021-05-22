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