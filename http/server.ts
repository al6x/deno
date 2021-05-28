import { p, take, some } from "base/base.ts"
import { Log } from "base/log.ts"
import { toYyyyMmDdHhMmSs } from "base/time.ts"
import { isProd } from "base/env.ts"
import { say } from "base/bash.ts"
import { assetFilePath } from "./util.ts"
import { Application, Middleware, Context, HttpError, Router } from "https://deno.land/x/oak/mod.ts"
import * as stdpath from "https://deno.land/std/path/mod.ts"

export { HttpError, Context, Router }
export type { Middleware }
export * from "./helpers.ts"

export interface CtxBaseState {
  log:           Log
  startedMs:     number
}

interface ServerConfig {
  readonly host:            string
  readonly port:            number
  readonly showErrors:      boolean
  readonly assetsPath:      string
  readonly assetsFilePaths: string[]
  readonly cacheAssets:     boolean
  readonly maxFileSize:     number
  readonly voice:           boolean
  readonly allowFavicon:    boolean
}

function defaultConfig(): ServerConfig { return {
  host:            "localhost",
  // domain:          "unknown",
  port:            8080,
  // catchErrors:     isProd(),
  showErrors:      !isProd(),
  assetsPath:      "/assets",
  assetsFilePaths: [stdpath.join(Deno.cwd(), "/assets")],
  cacheAssets:     isProd(),
  maxFileSize:     10_000_000, // 10 Mb
  voice:           true,
  allowFavicon:    false
}}

export class HttpServer<HttpState> {
  public readonly config: ServerConfig
  public readonly oak:    Application<CtxBaseState & HttpState>
  public readonly log:    Log

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultConfig(), ...config }
    this.oak    = new Application<CtxBaseState & HttpState>()
    this.log    = new Log("http")
    this.oak.addEventListener("listen", () => {
      if (this.config.voice) say("started").catch(() => {})
      this.log.with({ host: this.config.host, port: this.config.port }).info("started on http://{host}:{port}")
    })

    this.oak.use(this.buildAssetMiddleware())
    this.oak.use(this.buildBaseMiddleware())
  }

  // Logging, error handling
  private buildBaseMiddleware(): Middleware<CtxBaseState> {
    return async (ctx, next) => {
      if (ctx.request.url.pathname == "/favicon.ico" && !this.config.allowFavicon) {
        // Favicon should be already handled by the static assets middleware, if it's not handled
        // it means there's no favicon
        return ctx.throw(404, "Not found")
      }

      // Setting start time
      ctx.state.startedMs = Date.now()

      // Logging
      let log: Log
      {
        let method = ctx.request.method.toLowerCase()
        log = this.log
          .with({
            method,
            method4: take(method, 4).padEnd(4, " "),
            path:    ctx.request.url.pathname,
            time:    toYyyyMmDdHhMmSs(new Date())
          })
        ctx.state.log = log
      }

      // Processing
      try {
        log.info("{method4} {path} started")

        await next()

        log
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

  private buildAssetMiddleware(): Middleware<CtxBaseState> {
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


// Test --------------------------------------------------------------------------------------------
if (import.meta.main) {
  const server = new HttpServer({ assetsFilePaths: ["."]})

  // server.oak.use(router.routes())
  // server.oak.use(router.allowedMethods())

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