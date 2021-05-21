// deno run --import-map=import_map.json ./play.ts
import { p } from "base/base.ts"
import { encodeBase58, decodeBase58 } from "base/base58.js"
import {
  decode,
  encode,
} from "https://deno.land/std@0.97.0/encoding/base64.ts";
import { createHash } from "https://deno.land/std/hash/mod.ts"

// const hash = createHash("sha256")
// hash.update("Your data here")
// const final = hash.digest().toString("base64")


import { createHash } from "https://deno.land/std/hash/mod.ts";

const hash = createHash("sha256")
hash.update("Your data here")
let data = hash.digest()
// p(hash.toString("base64"))
p(encodeBase58(decodeBase58(encodeBase58(data))))


// proc sha256(data: string): string =
//   var sha = nimsha2.initSHA[nimsha2.SHA256]()
//   nimsha2.update(sha, data)
//   nimsha2.toHex nimsha2.final(sha)