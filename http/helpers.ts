import { p, test, assert, toJson } from "base/base.ts"
import { Context, HttpError } from "./deps.ts"
import { assetHash } from "./util.ts"


// isSafeFsPath ------------------------------------------------------------------------------------
export function isSafeFsPath(path: string): boolean {
  if (path.includes("..")) return false
  return true
}

export function ensureSafeFsPath(path: string): void {
  if (!isSafeFsPath(path)) throw new HttpError("invalid path!")
}

// escapeJs ----------------------------------------------------------------------------------------
export function escapeJs(js: unknown): string {
  if (js === undefined || js === null) return ""
  return JSON.stringify(js).replace(/^"|"$/g, "")
}
test("escapeJs", () => {
  assert.equal(escapeJs('); alert("hi there'), "); alert(\\\"hi there")
})


// escapeHtml --------------------------------------------------------------------------------------
const ESCAPE_HTML_MAP: { [key: string]: string } = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}
export function escapeHtml(html: unknown): string {
  if (html === undefined || html === null) return ''
  return ('' + html).replace(/[&<>'"]/g, function(c) { return ESCAPE_HTML_MAP[c] })
}
test("escapeHtml", () => {
  assert.equal(escapeHtml('<div>'), '&lt;div&gt;')
})


// assetPath ---------------------------------------------------------------------------------------
export async function assetPath(
  path: string, assetsPath: string, assetsFilePaths: string[], cache = true
): Promise<string> {
  if (!path.startsWith("/")) throw new Error(`Path should start with /, ${path}`)
  if (path.includes("..")) throw new Error(`Invalid path, ${path}`)
  const hash = cache ? await assetHash(path, assetsFilePaths) : Date.now()
  return `${assetsPath}${path}?hash=${hash}`
}


// setPermanentCookie ------------------------------------------------------------------------------
export async function setPermanentCookie(ctx: Context, k: string, v: string, domain: string, subdomains: boolean) {
  if (subdomains) domain = "." + domain
  ctx.cookies.set(k, v, { domain, expires: new Date(253402300000000), path: "/" })
}

export async function delPermanentCookie(ctx: Context, k: string, domain: string) {
  ctx.cookies.delete(k, { domain: "." + domain, path: "/" })
}

export async function setSessionCookie(ctx: Context, k: string, v: string) {
  ctx.cookies.set(k, v, { path: "/" })
}

export async function delSessionCookie(ctx: Context, k: string) {
  ctx.cookies.delete(k, { path: "/" })
}


// sendJson ----------------------------------------------------------------------------------------
export async function sendJson(ctx: Context, data: object) {
  ctx.response.headers.set("Content-Type", "application/json")
  ctx.response.body = toJson(data)
}