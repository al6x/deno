// deno run --import-map=import_map.json ./play.ts
import { p, assert } from "base/base.ts"

let id = "al6x"
p(id.length >= 4 && /^[a-z0-9]+$/.test(id))