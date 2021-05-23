// deno run --import-map=import_map.json ./play.ts
import { p } from "base/base.ts"

p(typeof BigInt(11))
// Number.isSafeInteger()