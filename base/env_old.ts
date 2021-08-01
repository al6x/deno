declare const Deno: any

const envCache = new Map<string, string | undefined>()

function get_env(key: string): string
function get_env(key: string, deflt: string): string
function get_env(key: string, deflt?: string): string {
  if (!envCache.has(key)) {
    try {      envCache.set(key, Deno.env.get(key)) }
    catch(e) { envCache.set(key, undefined) } // If there's no permission
  }
  const value = envCache.get(key) || deflt
  if (value == undefined) throw new Error(`env var '${key}' is not defined`)
  return value
}
export { get_env }

// environment mode --------------------------------------------------------------------------------
export function isProd(): boolean { return get_env("env", "dev") == "prod" }
export function isTest(): boolean { return get_env("env", "dev") == "test" }
export function isDev():  boolean { return get_env("env", "dev") == "dev" }