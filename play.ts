// deno run --import-map=import_map.json ./play.ts
import { p } from "base/base.ts"
import { secureRandomHash } from "base/crypto.ts"

p(secureRandomHash())