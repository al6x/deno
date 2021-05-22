import { p, take, something } from "./base.ts"
import { red, yellow, gray as grey } from "https://deno.land/std/fmt/colors.ts"
// import { grey, yellow, red } from "./terminal.ts"


// LogConfig ---------------------------------------------------------------------------------------
let env: {[key: string]: string | undefined} = {}
try {
  for (let key of ["disable_logs", "log_as_debug", "log_data"]) {
    env[key] = Deno.env.get(key)
  }
} catch(e) {
  // Ignoring if there's no `
}

const logConfig = {
  disableLogs: new Set((env["disable_logs"] || "").split(",")),
  logAsDebug:  new Set((env["log_as_debug"] || "").split(",")),
  logData:     env["log_data"] == "true"
}

function isEnabled(component: string, level: string): boolean {
  const [c, l] = [component.toLowerCase(), level.toLowerCase()]
  return !(logConfig.disableLogs.has(c) || logConfig.disableLogs.has(l) || logConfig.disableLogs.has(`{c}.{l}`))
}

function isDebug(component: string): boolean {
  return logConfig.logAsDebug.has(component.toLowerCase())
}


// Log ----------------------------------------------------------------------------------------------
export class Log {
  constructor(
    public readonly component: string,
    public readonly id:        string | undefined = undefined,
    public readonly data:      object | undefined = undefined
  ) {}

  with(data: object): Log {
    if (data instanceof Error) {
      return this.with({ message: data.message || "unknown error", trace: data.stack || "" })
    } else {
      return new Log(this.component, this.id, { ...(this.data || {}), ...data })
    }
  }

  debug(message: string): void {
    if (!isEnabled(this.component, "debug")) return
    const formatted = this.formatComponent() + this.formatId() + this.formatMessage(message) + this.formatData()
    console.log("  " + grey(formatted))
  }

  info(message: string): void {
    if (!isEnabled(this.component, "info")) return
    const formatted = this.formatComponent() + this.formatId() + this.formatMessage(message) + this.formatData()
    if (isDebug(this.component)) console.log("  " + grey(formatted))
    else                         console.log("  " + formatted)
  }

  warn(message: string): void {
    if (!isEnabled(this.component, "warn")) return
    const formatted = this.formatComponent() + this.formatId() + this.formatMessage(message) + this.formatData()
    console.log(yellow("W " + formatted))
  }

  error(message: string): void {
    if (!isEnabled(this.component, "warn")) return
    const formatted = this.formatComponent() + this.formatId() + this.formatMessage(message) + this.formatData()
    console.error(red("E " + message))
  }

  private formatComponent(): string {
    const maxLen = 4;
    return take(this.component, maxLen).toLowerCase().padStart(maxLen, " ") + " | "
  }

  private formatId(): string {
    if (this.id == undefined) return ""
    const maxLen = 7
    return take(this.id, maxLen).toLowerCase().padEnd(maxLen, " ") + " "
  }

  private formatData(): string {
    if (!logConfig.logData) return ""
    if (this.data == undefined) {
      return " | {}"
    } else {
      return " | " + JSON.stringify(this.data)
    }
  }

  private formatMessage(message: string): string {
    const keyre = /(\{[a-zA-Z0-9_]+\})/g
    return message.replace(keyre, (_match, skey) => {
      let value: string
      if (this.data == undefined) {
        value = skey.replace("\n", " ")
      } else {
        const key = skey.substring(1, skey.length - 1)
        value = (this.data as something)[key] || key
      }
      return value.replace("\n", " ")
    })
  }
}


// Shortcuts ----------------------------------------------------------------------------------------
export function debug(message: string): void { new Log("Main").debug(message) }

export function info(message: string): void { new Log("Main").info(message) }

export function warn(message: string): void { new Log("Main").warn(message) }

export function error(message: string, exception: Error | undefined = undefined): void {
  let log = new Log("Main")
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