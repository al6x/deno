// deno run --import-map=import_map.json --unstable --allow-net ws/examples/clock.ts

import { p, Errorneous, ensure } from "base/base.ts"
import { PubSub } from "../pubsub.ts"
import { RouterContext, Application, Router } from "https://deno.land/x/oak/mod.ts"


class TestPubSub extends PubSub {
  authorise(ctx: RouterContext): Errorneous<{ user_id: string, session_id: string, topics: string[] }> {
    const query = new URLSearchParams(ctx.request.url.search)
    const topics = (query.get("topics") || "").split(",")
    return { isError: false, value: { user_id: "user1", session_id: "session1", topics } }
  }
}
const pubsub = new TestPubSub()


setInterval(() => {
  pubsub.publish("time", { time: new Date() })
}, 3000)

const router = new Router()
router.get("/pubsub", pubsub.handle)

const app = new Application()
app.use(router.routes())
await app.listen({ port: 5000 })