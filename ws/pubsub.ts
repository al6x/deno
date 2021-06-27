import { p, Errorneous, ensure, once } from "base/base.ts"
import { Log } from "base/log.ts"
import { ServerSentEventTarget, Context } from "./deps.ts"

export abstract class PubSub {
  private readonly log: Log

  private readonly topics = new Map<string, Set<string>>() // topic -> session_id

  // session_id -> session
  private readonly sessions = new Map<string, {
    user_id: string,
    client:  ServerSentEventTarget,
    topics:  string[]
  }>()

  private readonly user_sessions = new Map<string, Set<string>>() // user_id -> user_sessions

  constructor(
    public readonly cors               = false,
    public readonly maxSessionsPerUser = 5,
    public readonly pingInterval       = 30000
  ) {
    this.log = new Log("PubSub")
    setTimeout(() => {
      setInterval(() => this.pingSessions(), this.pingInterval)
    })
  }

  publishForAllSessions(user_id: string, message: object) {
    this.log.with({ user_id, message: message }).info("publishing for user {user_id}")
    const sessions = this.user_sessions.get(user_id)
    if (!sessions) return
    for (const session_id of sessions) this.publishForSession(session_id, message)
  }

  publishForSession(session_id: string, message: object) {
    this.log.with({ session_id, message: message }).info("publishing for session {session_id}")
    const session = this.sessions.get(session_id)
    if (!session) return
    session.client.dispatchMessage(message)

    // Seem slike some bug, the first message is not published untill the second one is published
    session.client.dispatchMessage({ special: "ping" })
  }

  publish(topic: string, message: object) {
    this.log.with({ topic, message: message }).info("publishing for topic {topic}")
    const subscribers = this.topics.get(topic)
    if (!subscribers) return
    for (const session_id of subscribers) this.publishForSession(session_id, message)
  }

  subscribe(user_id: string, session_id: string, topics: string[]): void {
    this.log
      .with({ user_id, session_id, topics: topics.join(", ") })
      .info("subscribe {user_id} {session_id} to {topics}")
    for (const topic of topics) {
      if (!(topic in this.topics)) this.topics.set(topic, new Set())
      ensure(this.topics.get(topic)).add(session_id)
    }
  }

  abstract authorise(ctx: Context): Errorneous<{ user_id: string, session_id: string, topics: string[] }>
  // {
  //   const query = new URLSearchParams(ctx.request.url.search)
  //   const topics = (query.get("topics") || "").split(",")
  //   const session_token = query.get("session_token") || ctx.cookies.get("session_token")
  //   if (!session_token) return { isError: true, message: "no session token" }
  //   return { isError: false, value: { user_id: "some user", session_id: session_token, topics } }
  // }

  private pingSessions() {
    this.log.debug("ping")

    // Checkign closed
    const closed: string[] = []
    for (const [session_id, { client }] of this.sessions) {
      if (client.closed) closed.push(session_id)
    }
    for (const session_id of closed) this.closeSession(session_id)

    // Pinging to detect closed, will be closed in the next ping
    for (const session_id of this.sessions.keys()) {
      try { this.publishForSession(session_id, { special: "ping" }) }
      catch {}
    }
  }

  closeSession(session_id: string): void {
    const { user_id, client, topics } = ensure(this.sessions.get(session_id))
    this.log.with({ user_id, session_id }).info("{user_id} {session_id} close")
    this.sessions.delete(session_id)

    let user_sessions = ensure(this.user_sessions.get(user_id))
    user_sessions.delete(session_id)
    if (user_sessions.size == 0) this.user_sessions.delete(user_id)

    for (let topic of topics) {
      let subscribers = ensure(this.topics.get(topic))
      subscribers.delete(topic)
      if (subscribers.size == 0) this.topics.delete(topic)
    }

    try { client.close().catch((_error) => {}) } catch {}
  }

  handle = (ctx: Context): void => {
    // Authorising request
    const parsed = this.authorise(ctx)
    if (parsed.isError) {
      this.log.with({ url: ctx.request.url.toString() }).warn("not authorised, {url}")
      return ctx.throw(400, parsed.message)
    }
    const { user_id, session_id, topics } = parsed.value

    // Checking if can connect
    if (this.sessions.has(session_id)) {
      this.log.with({ user_id }).info("{user_id} closing session with same token")
      this.closeSession(session_id)
    }
    if (
      this.user_sessions.has(user_id) &&
      (ensure(this.user_sessions.get(user_id)).size == this.maxSessionsPerUser)
    ) {
      this.log.with({ user_id }).warn("{user_id} session limit exceeded")
      return ctx.throw(400, "session limit exceeded")
    }

    // Connecting
    this.log.with({ user_id, session_id }).info("{user_id} {session_id} connect")
    let client: ServerSentEventTarget | undefined
    try {
      const headers = this.cors ? new Headers([["Access-Control-Allow-Origin", "*"]]) : new Headers()
      const tmpClient = ctx.sendEvents({ headers })

      // close is not reliable
      // tmpClient.addEventListener("close", (_event) => {
      //   this.log.with({ user_id }).info("{user_id} closing")
      //   this.closeSession(session_id)
      // })
      client = tmpClient
    } catch (e) {
      if (e) this.log.with(e).with({ user_id, session_id }).warn("{user_id} {session_id} can't connect")
    }

    if (!client) {
      try { ctx.response.destroy() } catch {}
      return
    }

    // Finishing connecting
    this.sessions.set(session_id, { user_id, client, topics })

    this.subscribe(user_id, session_id, topics)

    if (!this.user_sessions.has(user_id)) this.user_sessions.set(user_id, new Set())
    ensure(this.user_sessions.get(user_id)).add(session_id)
  }
}