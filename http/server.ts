import "base/base.ts"
import { Log } from "base/log.ts"
import { Time } from "base/time.ts"
import { say } from "base/bash.ts"
import { assetFilePath } from "./util.ts"
import { escapeHtml, ensureSafeFsPath, cache_forever } from "./helpers.ts"
import { Application, Middleware, Context, HttpError, Router } from "./deps.ts"
import * as stdpath from "./deps.ts"

export { HttpError, Context, Router }
export type { Middleware }
export * from "./helpers.ts"

export interface CtxBaseState {
  log:           Log
  startedMs:     number
}

interface ServerConfig {
  // readonly host:            string
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
  // host:            "localhost",
  port:            8080,
  showErrors:      !is_prod(),
  assetsPath:      "/assets",
  assetsFilePaths: [stdpath.join(Deno.cwd(), "/assets")],
  cacheAssets:     is_prod(),
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
      this.log.with({ port: this.config.port }).info("started on {port} port")
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
            method4: method.take(4).padEnd(4, " "),
            path:    ctx.request.url.pathname,
            time:    Time.now().to_s()
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
            .with(e)
            .with({ duration_ms: Date.now() - ctx.state.startedMs })
            .warn("{method4} {path} failed, {duration_ms}ms")
          ctx.response.status = 400
          ctx.response.body = `<!DOCTYPE html>
            <html>
              <body>
                400 ${escapeHtml(e.message)}
              </body>
            </html>`
        } else if (e instanceof Error) {
          log.error(e)
          ctx.response.status = 500
          ctx.response.body = `<!DOCTYPE html>
            <html>
              <body>
                <div>500 - ${this.config.showErrors ? escapeHtml(e.message) : "Internal Server Error"}</div>
                ${this.config.showErrors && `<pre>${escapeHtml(e.stack)}</pre>`}
              </body>
            </html>`
        }
      }
    }
  }

  private buildAssetMiddleware(): Middleware<CtxBaseState> {
    const assetsPathPrefix = this.config.assetsPath + "/"
    return async (ctx, next) => {
      const url = ctx.request.url, path = url.pathname
      if(path.startsWith(assetsPathPrefix)) {
        ensureSafeFsPath(path)
        let found = await assetFilePath(path.replace(assetsPathPrefix, "/"), this.config.assetsFilePaths)
        if (!found.is_error) {
          await ctx.send({
            path: found.value, root: "/", ...(this.config.cacheAssets ? cache_forever() : {})
          })
        } else {
          ctx.throw(404, `Asset not found`)
        }
      } else {
        await next()
      }
    }
  }

  start(): Promise<void> {
    return this.oak.listen({ port: this.config.port }) // With explicit hostname it's not working on linode
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