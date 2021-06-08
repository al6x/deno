// tsc --lib "es6,dom" --target es5 --module none ws/client/pubsub.ts
// cp ws/client/pubsub.js plot/assets/api-v1/assets/pubsub.js

// First reconnect is instant, consequent reconnects are randomised progressive `+ increment_ms`

type some = any
type OnMessage = (message: object) => void

class PubSubClient {
  private es?:     some
  private fullUrl: string

  constructor(
                    url:       string,
    public readonly topics:    string[],
    public readonly onmessage: OnMessage,

    public readonly increment_ms           = 500,
    public readonly max_reconnect_delay_ms = 10000
  ) {
    this.fullUrl = url + (url.includes("?") ? "&" : "?") + "topics=" + encodeURIComponent(topics.join(","))
    this.reconnect(1)
  }

  close() {
    if (!this.es) return
    info("closing")
    try { this.es.close() } catch (e) {}
    this.es = undefined
  }

  private reconnect(attempt: number) {
    info("connecting to " + this.fullUrl)
    let es = new (window as some).EventSource(this.fullUrl)
    this.es = es

    function closeAgain() {
      // Sometimes it's still not closed
      warn("closing again")
      try { es.close() } catch (e) {}
    }

    let success = false, closed = false
    es.onopen = (_event: some) => {
      if (closed) {
        closeAgain()
        return
      }
      info("connected")
      success = true
    }

    es.onmessage = (event: some) => {
      if (closed) {
        closeAgain()
      }

      success = true

      let message = JSON.parse(event.data)

      if ("special" in message) {
        switch (message.special) {
          case "ping":  return
          case "flush": return
          default:      console.error("pubsub, unknown special message " + message.special)
        }
      }

      // Server may resend message twice, if network error occured, id is random and not not increasing
      // if (last_messages_ids[message.topic] == message.id) return
      // last_messages_ids[message.topic] = message.id

      this.onmessage(message)
    }

    es.onerror = (_event: some) => {
      if (closed) {
        closeAgain()
        return
      }
      this.close()
      closed = true

      if (success) {
        // First reconnect not counted as error
        info("disconnected, reconnecting")
        setTimeout(() => this.reconnect(1), 1)
      } else {
        let delay_ms = this.calculateTimeoutMs(success ? 1 : attempt + 1)
        error("error, will try to reconnect for " + (attempt + 1) + "th time, after " + delay_ms + "ms")
        setTimeout(() => this.reconnect(attempt + 1), delay_ms)
      }
    }
  }

  private calculateTimeoutMs(attempt: number) {
    // Timeout is randomised, but it never will be more than the max timeout
    let delay_ms = attempt == 1 ?
      0 :
      Math.min(this.max_reconnect_delay_ms, Math.pow(2, attempt - 1) * this.increment_ms)
    // Randomising to distribute server load evenly
    return Math.round(((Math.random() * delay_ms) + delay_ms) / 2)
  }
}

function info(msg: string) { console.log("  pubsub " + msg) }
function error(msg: string) { console.log("E pubsub " + msg) }
function warn(msg: string) { console.log("W pubsub " + msg) }

// export function secureRandomHash(lengthB = 32): string {
//   const data = new Uint8Array(lengthB)
//   crypto.getRandomValues(data)

//   // Encoding as base58
//   const base58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
//   let hash = ""
//   for(let i = 0; i < data.length; i++) hash += base58[Math.floor(Math.random() * base58.length)]
//   return hash
// }

// declare class EventSource {
//   constructor(url: string)
//   close(): void
//   onerror: ((this: EventSource, ev: Event) => any) | null
//   onmessage: ((this: EventSource, ev: MessageEvent) => any) | null
//   onopen: ((this: EventSource, ev: Event) => any) | null
// }