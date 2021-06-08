declare const Deno: any

const envCache = new Map<string, string | undefined>()

function getEnv(key: string): string
function getEnv(key: string, deflt: string): string
function getEnv(key: string, deflt?: string): string {
  if (!envCache.has(key)) {
    try {      envCache.set(key, Deno.env.get(key)) }
    catch(e) { envCache.set(key, undefined) } // If there's no permission
  }
  const value = envCache.get(key) || deflt
  if (value == undefined) throw new Error(`env var '${key}' is not defined`)
  return value
}
export { getEnv }

// environment mode --------------------------------------------------------------------------------
export function isProd(): boolean { return getEnv("env", "dev") == "prod" }
export function isTest(): boolean { return getEnv("env", "dev") == "test" }
export function isDev():  boolean { return getEnv("env", "dev") == "dev" }