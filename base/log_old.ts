// log ----------------------------------------------------------------------------
let cachedIsDebugEnabled: boolean | undefined = undefined
export function isDebugEnabled(): boolean {
  if (cachedIsDebugEnabled == undefined)
    cachedIsDebugEnabled = deno?.env.get('debug')?.toLowerCase() == "true"
  return cachedIsDebugEnabled
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

function pad0(v: string | number) { return v.toString().length < 2 ? '0' + v : v }
export function getFormattedTime(time: number, withSeconds = true) {
  let date = new Date(time)
  // year = date.getFullYear()
  return `${pad0(date.getMonth() + 1)}/${pad0(date.getDate())} `
  + `${pad0(date.getHours())}:${pad0(date.getMinutes())}${withSeconds ? ':' + pad0(date.getSeconds()) : ''}`
}

export let inspect: (o: something) => string = (o) => deno.inspect(o, { depth: 10 }).replace(/^'|'$/g, '')

const levelReplacements: { [key: string]: string } =
  { debug: 'debug', info: '     ', warn: 'warn ', error: 'error' }

const logFormat = isBrowser() ? ((o: something) => o) : (o: something) => {
  if (o === null || o === undefined || typeof o == 'string' || typeof o == 'number') return o
  return toJson(o)
}

// Some errors may contain additional properties with huge data, stripping it
const logCleanError = (error: Error) => {
  const clean = new Error(error.message)
  clean.stack = error.stack
  return clean
}

// function log(message: string, short?: something, detailed?: something): void
function log(
  level: LogLevel, message: string, short?: something, detailed?: something
): void {
  if (level == 'debug' && !isDebugEnabled()) return
  getEnvironment() == 'development' ?
    logInDevelopment(level, message, short, detailed) :
    logNotInDevelopment(level, message, short, detailed)
}
export { log }

function logInDevelopment(
  level: LogLevel, message: string, short?: something, detailed?: something
): void {
  let buff: something[] = [levelReplacements[level]]
  buff.push(message)

  let error: Error | undefined = undefined
  if (short !== null && short !== undefined) {
    if (short instanceof Error) error = logCleanError(short)
    else                        buff.push(logFormat(short))
  }

  if (detailed !== null && detailed !== undefined) {
    if (detailed instanceof Error) error = logCleanError(detailed)
    else                           buff.push(logFormat(detailed))
  }

  // buff = buff.map((v: something) => deepMap(v, mapToJsonIfDefined))

  console[level](...buff)

  // Printing error separately in development
  if (error) {
    const cleanError = ensure_error(error)
    cleanError.stack = cleanStack(error.stack || '')
    console.log('')
    console.error(cleanError)
    console.log('')
  }
}

function logNotInDevelopment(
  level: LogLevel, message: string, short?: something, detailed?: something
): void {
  let buff: something[] = [levelReplacements[level]]

  buff.push(getFormattedTime(Date.now()))
  buff.push(message)

  if (short !== null && short !== undefined)
    buff.push(logFormat(short instanceof Error ? logCleanError(short) : short))

  if (detailed !== null && detailed !== undefined)
    buff.push(logFormat(short instanceof Error ? logCleanError(detailed) : detailed))

  // Printing
  console[level](...buff)
}