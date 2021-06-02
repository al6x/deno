// deno run --import-map=import_map.json --allow-net ./play.ts
import { p, buildUrl, some } from "base/base.ts"
import { Application } from "https://deno.land/x/oak/mod.ts"

const app = new Application()

app.use((ctx) => {
  const data = {} as some
  ctx.request.headers.forEach((k, v) => data[v] = k)
  ctx.response.body = `
    <html>
    <head>
      <script src="/some.js"></script>
      <script src="http://plot.com/some.js"></script>
    </head>
    <body>
      <img src="/some.png"></script>
      <img src="http://plot/some.png"></script>
    </body>
  </html>
  `
  console.log("\n")
  console.log("" + ctx.request.url)
  console.log(data)
});

await app.listen({ port: 8080 })