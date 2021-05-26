const envCache = new Map<string, string | undefined>()

function getEnv(key: string): string | undefined
function getEnv(key: string, deflt: string): string
function getEnv(key: string, deflt?: string): string | undefined {
  if (!envCache.has(key)) {
    try {      envCache.set(key, Deno.env.get(key)) }
    catch(e) { envCache.set(key, undefined) } // If there's no permission
  }
  return envCache.get(key) || deflt
}
export { getEnv }

// environment mode --------------------------------------------------------------------------------
export function isProd(): boolean { return getEnv("env") == "prod" }
export function isTest(): boolean { return getEnv("env") == "test" }
export function isDev(): boolean { return !(isProd() || isTest()) }