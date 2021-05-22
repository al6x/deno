import { encodeBase58, decodeBase58 } from "base/base58.js"
import { createHash } from "https://deno.land/std/hash/mod.ts"

export function hash(data: number | string | Uint8Array | ArrayBuffer, algo: 'md5' | 'sha256'): string {
  if (typeof data == "number") data = '' + data
  const hash = createHash(algo).update(data)
  return encodeBase58(hash.digest())
}