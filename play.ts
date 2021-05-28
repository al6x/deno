// deno run --import-map=import_map.json ./play.ts
import { p } from "base/base.ts"

let regexp = /(.) (.) c/
p("a b c".match(regexp))