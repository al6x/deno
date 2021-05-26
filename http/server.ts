import { p, take } from "base/base.ts"
import { Log } from "base/log.ts"
import { toYyyyMmDdHhMmSs } from "base/time.ts"
import { isProd, isDev } from "base/env.ts"
import * as crypto from "base/crypto.ts"
import { say } from "base/bash.ts"
import { setPermanentCookie, setSessionCookie } from "./helpers.ts"
import { assetFilePath } from "./util.ts"
import { Application, Middleware, Context, HttpError } from "https://deno.land/x/oak/mod.ts"
import * as stdpath from "https://deno.land/std/path/mod.ts"

export { HttpError }

export interface HttpServerState {
  log:           Log
  startedMs:     number
  user_token:    string
  session_token: string
}

export type HttpServerMiddleware = Middleware<HttpServerState, Context<HttpServerState, HttpServerState>>

interface ServerConfig {
  readonly host:            string
  readonly domain:          string // Used for cookie user_token
  readonly port:            number
  // readonly catchErrors:     boolean
  readonly showErrors:      boolean
  readonly assetsPath:      string
  readonly assetsFilePaths: string[]
  readonly cacheAssets:     boolean
  readonly maxFileSize:     number
  readonly voice:           boolean
}

function defaultConfig(): ServerConfig { return {
  host:            "localhost",
  domain:          "unknown",
  port:            8080,
  // catchErrors:     isProd(),
  showErrors:      !isProd(),
  assetsPath:      "/assets",
  assetsFilePaths: [stdpath.join(Deno.cwd(), "/assets")],
  cacheAssets:     isProd(),
  maxFileSize:     10_000_000, // 10 Mb
  voice:           isDev()
}}

export class HttpServer {
  public readonly config: ServerConfig
  public readonly oak:    Application<HttpServerState>
  public readonly log:   Log

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultConfig(), ...config }
    this.oak    = new Application<HttpServerState>()
    this.log    = new Log("http")
    this.oak.addEventListener("listen", () => {
      if (this.config.voice) say("started").catch(() => {})
      this.log.with({ host: this.config.host, port: this.config.port }).info("started on http://{host}:{port}")
    })

    this.oak.use(this.buildBaseMiddleware())
    this.oak.use(this.buildAssetMiddleware())
  }

  // Logging and error handling
  private buildBaseMiddleware(): HttpServerMiddleware {
    return async (ctx, next) => {
      // Setting start time
      ctx.state.startedMs = Date.now()

      // Preparing log
      let skipLogging = ctx.request.url.pathname == "/favicon.ico"
      let method = ctx.request.method.toLowerCase()
      let log = this.log
        .with({
          method,
          method4: take(method, 4).padEnd(4, " "),
          path:    ctx.request.url.pathname,
          time:    toYyyyMmDdHhMmSs(new Date())
        })
      if (!skipLogging) log.info("{method4} {path} started")
      ctx.state.log = log

      // Processing
      try {
        await next()

        if (!skipLogging) log
          .with({ duration_ms: Date.now() - ctx.state.startedMs })
          .info("{method4} {path} finished, {duration_ms}ms")
      } catch (e) {
        // Handling errors
        if (e instanceof HttpError) {
          log
            .with({ duration_ms: Date.now() - ctx.state.startedMs })
            .warn("{method4} {path} failed, {duration_ms}ms")
          ctx.response.status = 400
          ctx.response.body = `<!DOCTYPE html>
            <html>
              <body>
                400 ${e.message}
              </body>
            </html>`
        } else if (e instanceof Error) {
          log.error(e)
          ctx.response.status = 500
          ctx.response.body = `<!DOCTYPE html>
            <html>
              <body>
                500 - ${this.config.showErrors ? e.message : "Internal Server Error"}
              </body>
            </html>`
        }
      }
    }
  }

  buildAuthMiddleware(setTokens: boolean): HttpServerMiddleware {
    return async (ctx, next) => {
      // Parsing user and session tokens
      {
        const query = ctx.request.url.searchParams

        let user_token = query.get("user_token") || ctx.cookies.get("user_token")
        if (!user_token) {
          if (!setTokens) throw new Error("no user_token")
          user_token = crypto.secureRandomHash()
          setPermanentCookie(ctx, "user_token", user_token, this.config.host)
        }
        ctx.state.user_token = user_token

        let session_token = query.get("session_token") || ctx.cookies.get("session_token")
        if (!session_token) {
          if (!setTokens) throw new Error("no session_token")
          session_token = crypto.secureRandomHash()
          setSessionCookie(ctx, "session_token", session_token)
        }
        ctx.state.session_token = session_token
      }

      await next()
    }
  }

  buildAssetMiddleware(): HttpServerMiddleware {
    return async (ctx, next) => {
      let found = await assetFilePath(ctx.request.url.pathname, this.config.assetsFilePaths)
      if (found.found) {
        await ctx.send({
          path: found.value, root: stdpath.dirname(found.value), immutable: true
        })
      } else {
        await next()
      }
    }
  }

  start(): Promise<void> {
    return this.oak.listen({ port: this.config.port, hostname: "127.0.0.1" })
  }
}

// Test --------------------------------------------------------------------------------------------
if (import.meta.main) {
  const server = new HttpServer({ assetsFilePaths: ["."]})

  server.oak.use((ctx) => {
    ctx.response.body = "Hello world!"
  })

  await server.start()
  // # server.get("/api/users/:name/profile", (req: Request) =>
  // #   (name: req["name"], age: 20)
  // # )

  // server.get("/", proc (req: Request): auto =
  //   respond "ok"
  // )

  // server.get_data("/api/users/:name/profile", (req: Request) =>
  //   (name: req["name"], age: 20)
  // )

  // server.get("/users/:name/profile", proc(req: Request): auto =
  //   let name = req["name"]
  //   respond fmt"Hi {name}"
  // )

  // server.impl(port = 80)
  // server.run
}