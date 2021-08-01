// deno run --import-map=import_map.json --unstable --allow-net ws/examples/clock.ts

import "base/base.ts"
import { PubSub } from "../pubsub.ts"
import { Context, Application, Router } from "../deps.ts"


class TestPubSub extends PubSub {
  authorise(ctx: Context): E<{ user_id: string, session_id: string, topics: string[] }> {
    const topics = (ctx.request.url.searchParams.get("topics") || "").split(",")
    return { is_error: false, value: { user_id: "user1", session_id: "session1", topics } }
  }
}
const pubsub = new TestPubSub(true)

let i = 0
setInterval(() => {
  i++
  pubsub.publish("time", { i, time: new Date() })
}, 3000)

const router = new Router()
router.get("/pubsub", pubsub.handle)

const app = new Application()
app.use(router.routes())
await app.listen({ port: 5000 })