import { p, take, some } from "base/base.ts"
import * as fs from "base/fs.ts"
import { Log } from "base/log.ts"
import { toYyyyMmDdHhMmSs } from "base/time.ts"
import { isProd, isDev } from "base/env.ts"
import * as crypto from "base/crypto.ts"
import { say } from "base/bash.ts"
import { setPermanentCookie, setSessionCookie } from "./helpers.ts"
import { assetFilePath } from "./util.ts"
import { Application, Middleware, Context, HttpError, Router,
  FormDataReadOptions } from "https://deno.land/x/oak/mod.ts"
import { upload, preUploadValidate } from "https://deno.land/x/upload_middleware_for_oak/mod.ts"
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

    this.oak.use(this.buildAssetMiddleware())
    this.oak.use(this.buildBaseMiddleware())
  }

  // Logging, error handling, user/session tokens
  private buildBaseMiddleware(): HttpServerMiddleware {
    return async (ctx, next) => {
      // Setting start time
      ctx.state.startedMs = Date.now()

      // Logging
      {
        let method = ctx.request.method.toLowerCase()
        let log = this.log
          .with({
            method,
            method4: take(method, 4).padEnd(4, " "),
            path:    ctx.request.url.pathname,
            time:    toYyyyMmDdHhMmSs(new Date())
          })
        let skipLogging = ctx.request.url.pathname == "/favicon.ico"
        if (skipLogging) log = log.silence()
        ctx.state.log = log
      }

      // Processing
      try {
        // AuthTokens
        // if (!ctx.state.user_token) throw new Error("user_token not set")
        // if (!ctx.state.session_token) throw new Error("session_token not set")

        ctx.state.log.info("{method4} {path} started")

        await next()

        ctx.state.log
          .with({ duration_ms: Date.now() - ctx.state.startedMs })
          .info("{method4} {path} finished, {duration_ms}ms")
      } catch (e) {
        // Handling errors
        if (e instanceof HttpError) {
          ctx.state.log
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
          ctx.state.log.error(e)
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
      // User and session tokens
      const query = ctx.request.url.searchParams
      // ctx.state.user_token    = query.get("user_token")    || ctx.cookies.get("user_token")
      // ctx.state.session_token = query.get("session_token") || ctx.cookies.get("session_token")

      await next()

      // user_token = crypto.secureRandomHash()
      // setPermanentCookie(ctx, "user_token", user_token, this.config.host)
      // setSessionCookie(ctx, "session_token", session_token)
    }
  }

  private buildAssetMiddleware(): HttpServerMiddleware {
    return async (ctx, next) => {
      if(ctx.request.url.pathname.startsWith(this.config.assetsPath + "/")) {
        let found = await assetFilePath(ctx.request.url.pathname, this.config.assetsFilePaths)
        if (!found.found) throw new HttpError("Not found")
        await ctx.send({
          path: found.value, root: stdpath.dirname(found.value), immutable: this.config.cacheAssets
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

function getAuthTokens(ctx: Context): { user_token?: string, session_token?: string } {
  const query = ctx.request.url.searchParams
  const user_token    = query.get("user_token")    || ctx.cookies.get("user_token")
  const session_token = query.get("session_token") || ctx.cookies.get("session_token")
  return { user_token, session_token }
}

// Test --------------------------------------------------------------------------------------------
if (import.meta.main) {
  const server = new HttpServer({ assetsFilePaths: ["."]})
  const uploadOptions: FormDataReadOptions = {
    bufferSize:  262_144,    // 2^18 The size of the buffer to read from the request body at a single time
    maxFileSize: 2_097_152,  // 2^21 The maximum file size
    outPath:     await Deno.makeTempDir() // Path to store temporary files, Deno.makeTempDir()
  }
  const router = new Router<some, HttpServerState>()
  router.post("/upload", async (ctx) => {
    const body = await ctx.request.body({ type: 'form-data'})
    const data = await body.value.read(uploadOptions)
    for (const file of (data.files || [])) {
      if (!file.filename) throw new Error("no filename")
      await fs.move(file.filename, `./tmp/http_uploaded_files/${file.name}`, { overwrite: true })
    }
  })

  server.oak.use(router.routes())
  server.oak.use(router.allowedMethods())

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