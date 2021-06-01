// tsc --lib "es6,dom" --target es5 --module none ws/client/pubsub.ts
var PubSubClient = /** @class */ (function () {
    function PubSubClient(url, topics, onmessage, increment_ms, max_reconnect_delay_ms) {
        if (increment_ms === void 0) { increment_ms = 500; }
        if (max_reconnect_delay_ms === void 0) { max_reconnect_delay_ms = 10000; }
        this.topics = topics;
        this.onmessage = onmessage;
        this.increment_ms = increment_ms;
        this.max_reconnect_delay_ms = max_reconnect_delay_ms;
        this.fullUrl = url + (url.includes("?") ? "&" : "?") + "topics=" + encodeURIComponent(topics.join(","));
        this.reconnect(1);
    }
    PubSubClient.prototype.close = function () {
        if (!this.es)
            return;
        info("closing");
        try {
            this.es.close();
        }
        catch (e) { }
        this.es = undefined;
    };
    PubSubClient.prototype.reconnect = function (attempt) {
        var _this = this;
        info("connecting to " + this.fullUrl);
        var es = new window.EventSource(this.fullUrl);
        this.es = es;
        function closeAgain() {
            // Sometimes it's still not closed
            warn("closing again");
            try {
                es.close();
            }
            catch (e) { }
        }
        var success = false, closed = false;
        es.onopen = function (_event) {
            if (closed) {
                closeAgain();
                return;
            }
            info("connected");
            success = true;
        };
        es.onmessage = function (event) {
            if (closed) {
                closeAgain();
            }
            success = true;
            var message = JSON.parse(event.data);
            if ("special" in message) {
                switch (message.special) {
                    case "ping": return;
                    case "flush": return;
                    default: console.error("pubsub, unknown special message " + message.special);
                }
            }
            // Server may resend message twice, if network error occured, id is random and not not increasing
            // if (last_messages_ids[message.topic] == message.id) return
            // last_messages_ids[message.topic] = message.id
            _this.onmessage(message);
        };
        es.onerror = function (_event) {
            if (closed) {
                closeAgain();
                return;
            }
            _this.close();
            closed = true;
            if (success) {
                // First reconnect not counted as error
                info("disconnected, reconnecting");
                setTimeout(function () { return _this.reconnect(1); }, 1);
            }
            else {
                var delay_ms = _this.calculateTimeoutMs(success ? 1 : attempt + 1);
                error("error, will try to reconnect for " + (attempt + 1) + "th time, after " + delay_ms + "ms");
                setTimeout(function () { return _this.reconnect(attempt + 1); }, delay_ms);
            }
        };
    };
    PubSubClient.prototype.calculateTimeoutMs = function (attempt) {
        // Timeout is randomised, but it never will be more than the max timeout
        var delay_ms = attempt == 1 ?
            0 :
            Math.min(this.max_reconnect_delay_ms, Math.pow(2, attempt - 1) * this.increment_ms);
        // Randomising to distribute server load evenly
        return Math.round(((Math.random() * delay_ms) + delay_ms) / 2);
    };
    return PubSubClient;
}());
function info(msg) { console.log("  pubsub " + msg); }
function error(msg) { console.log("E pubsub " + msg); }
function warn(msg) { console.log("W pubsub " + msg); }
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
