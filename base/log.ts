import "./base.ts"
import { colors } from "./deps.ts"

const { red, yellow, gray: grey } = colors

export const logConfig = {
  log:         get_env("log", "true") != "false",
  disableLogs: new Set(get_env("disable_logs", "").split(",").filter((v) => v != "")),
  logAsDebug:  new Set(get_env("log_as_debug", "").split(",").filter((v) => v != "")),
  logData:     get_env("log_data", "false") == "true"
}

function isEnabled(component: string, level: string): boolean {
  if (!logConfig.log) return false
  const [c, l] = [component.toLowerCase(), level.toLowerCase()]
  return !(logConfig.disableLogs.has(c) || logConfig.disableLogs.has(l) || logConfig.disableLogs.has(`{c}.{l}`))
}

function isDebug(component: string): boolean {
  return logConfig.logAsDebug.has(component.toLowerCase())
}


// Log ----------------------------------------------------------------------------------------------
export class Log {
  static logMethod = (log: Log) => defaultLogMethod(log) // Could be overrided

  constructor(
    public readonly component:  string,
    public readonly ids:        string[] = [],
    public readonly data:       { [key: string]: unknown } = {},
    // public readonly isSilenced: boolean = false
  ) {}

  // silence(): Log {
  //   return new Log(this.component, [...this.ids], { ...this.data }, true)
  // }

  with(id: string | number): Log
  with(data: Error): Log
  with(data: { [key: string]: unknown }): Log
  with(data: { [key: string]: unknown } | Error | string | number): Log {
    if (data instanceof Error) {
      return this.with({ exception: data.message || "unknown error", stack: data.stack || "" })
    } else if (typeof data == "string" || typeof data == "number") {
      return new Log(this.component, [...this.ids, "" + data], { ...this.data })
      // return new Log(this.component, [...this.ids, "" + data], { ...this.data }, this.isSilenced)
    } else {
      let log = new Log(this.component, [...this.ids], { ...this.data })
      // let log = new Log(this.component, [...this.ids], { ...this.data }, this.isSilenced)
      let sdata = data as any
      for (const k in sdata) {
        let v = sdata[k]
        if (k == "id")       log.ids.push("" + v)
        else if (k == "ids") log.ids.push(...(Array.isArray(v) ? v.map((id) => "" + id) : ["" + v]))
        else                 (log.data as any)[k] = v
      }
      return log
    }
  }

  message(msg: { [key: string]: unknown }): void {
    defaultLogMethod(this.with(msg))
  }

  debug(message: string): void {
    this.message({ debug: message })
  }

  info(message: string): void {
    this.message({ info: message })
  }

  warn(message: string): void {
    this.message({ warn: message })
  }

  error(message: string | Error): void {
    if (message instanceof Error) this.with(message).message({ error: message.message || "unknown error" })
    else                          this.message({ error: message })
  }

  logfn(log: LogFn): void {
    if (log == undefined) return
    typeof log == "string" ? this.info(log) : log(this)
  }
}


function defaultLogMethod(log: Log): void {
  // Detecting level and message
  let level = ""; let msg = ""
  for (const l of ["debug", "info", "warn", "error"]) {
    if (l in log.data) {
      level = l; msg = "" + (log.data[l] || "invalid log message type")
      break
    }
  }
  if (level == "") {
    defaultLogMethod(log.with({ warn: "invalid log message, no level" }))
    return
  }

  // Checking config
  if (!isEnabled(log.component, level)) return
  // if (!isEnabled(log.component, level) || log.isSilenced) return

  // Formatting message
  let line =
    formatComponent(log.component) +
    formatIds(log.ids) +
    formatMessage(msg, log.data) +
    formatData(log.data)

  // Formatting level
  if        (level == "debug") {
    console.log("  " + grey(line))
  } else if (level == "info") {
    let asGrey = isDebug(log.component)
    console.log("  " + (asGrey ? grey(line) : line))
  } else if (level == "warn") {
    console.log(yellow("W " + line))
  } else if (level == "error") {
    console.error(red("E " + line))
  }

  // Printing exception and stack if exist
  // if ("exception" in log.data) {
  //   let exception = "" + (log.data["exception"] || "can't get exception")
  //   console.error("\n" + red(exception))
  // }
  if ("stack" in log.data) {
    let stack = "" + (log.data["stack"] || "can't get stack")
    console.error("\n" + stack)
  }
}

function formatComponent(component: string): string {
  const maxLen = 4
  return component.take(maxLen).toLowerCase().padStart(maxLen, " ") + " | "
}

function formatIds(ids: string[]): string {
  const maxLen = 7
  return ids.map((id) => id.take(maxLen).toLowerCase().padEnd(maxLen, " ") + " ").join(", ")
}

function formatData(data: { [key: string]: unknown }): string {
  if (!logConfig.logData) return ""
  return Object.is_empty(data) ? "" : " | " + to_json(data)
}

function formatMessage(message: string, data: { [key: string]: unknown }): string {
  const keyre = /(\{[a-zA-Z0-9_]+\})/g
  return message.replace(keyre, (_match, skey) => {
    let value: string
    const key = skey.substring(1, skey.length - 1)
    value = key in data ? data[key] : key
    return ("" + value).replace(/\n/g, " ")
  })
}


// LogFn --------------------------------------------------------------------------------------------
export type LogFn = ((log: Log) => void) | string | undefined


// Shortcuts ----------------------------------------------------------------------------------------
export function debug(message: string): void { new Log("").debug(message) }

export function info(message: string): void { new Log("").info(message) }

export function warn(message: string): void { new Log("").warn(message) }

export function error(message: string, exception: Error | undefined = undefined): void {
  let log = new Log("")
  if (exception != undefined) log = log.with(exception)
  log.error(message)
}


// Test --------------------------------------------------------------------------------------------
// deno run --import-map=import_map.json --allow-env base/log.ts
if (import.meta.main) {
  const log = new Log("Finance")
  log.with({ symbol: "MSFT", currency: "USD" }).info("getting prices for {symbol} in {currency}")

  // Chaining
  log.with({ symbol: "MSFT" }).with({ currency: "USD" }).info("getting prices for {symbol} in {currency}")
}