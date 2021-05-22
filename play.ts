// deno run --import-map=import_map.json --allow-net ./play.ts
import { p } from "base/base.ts"

import { Application, Router } from "https://deno.land/x/oak/mod.ts";

const app = new Application();
const router = new Router();

router.get("/pubsub", (ctx) => {
  const headers = new Headers([["Access-Control-Allow-Origin", "*"]]);
  const target = ctx.sendEvents({ headers });
  target.addEventListener("close", (evt) => {
    console.log("closed")
  });
  // setInterval(() => {
  //   try {target.dispatchMessage({ok: 1})} catch {}
  // }, 1000)
});

app.use(router.routes());
await app.listen({ port: 5000 });