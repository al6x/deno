import "base/base.ts"
import { encodeBase58, decodeBase58 } from "base/base58.ts"
import * as deps from "./deps.ts"

export type InputType = number | string | Uint8Array | ArrayBuffer

export function hash(data: InputType, algo: 'md5' | 'sha256' = 'md5', encoding: 'base58' = 'base58'): string {
  if (typeof data == "number") data = '' + data

  const hash = deps.hash.createHash(algo).update(data)

  if (encoding == 'base58') return encodeBase58(hash.digest())
  else                      throw 'unknown encoding'
}

export function secureRandomHash(lengthB = 32): string {
  const data = new Uint8Array(lengthB)
  crypto.getRandomValues(data)
  return encodeBase58(data)
}

export async function file_hash(path: string, algo: 'md5' | 'sha256'): Promise<string> {
  let file: any
  try {
    file = await Deno.open(path)
    const hash = deps.hash.createHash(algo)
    for await (const chunk of Deno.iter(file)) hash.update(chunk)
    return encodeBase58(hash.digest())
  } finally {
    if (file) Deno.close(file.rid);
  }
}


// Test --------------------------------------------------------------------------------------------
// deno run --import-map=import_map.json --unstable base/crypto.ts
if (import.meta.main) {
  console.log(hash("some", 'md5'))
}