import { some } from "base/base.ts"
import { encodeBase58, decodeBase58 } from "base/base58.ts"
import * as deps from "./deps.ts"

export function hash(data: number | string | Uint8Array | ArrayBuffer, algo: 'md5' | 'sha256'): string {
  if (typeof data == "number") data = '' + data
  const hash = deps.hash.createHash(algo).update(data)
  return encodeBase58(hash.digest())
}

export function secureRandomHash(lengthB = 32): string {
  const data = new Uint8Array(lengthB)
  crypto.getRandomValues(data)
  return encodeBase58(data)
}

export async function fileHash(path: string, algo: 'md5' | 'sha256'): Promise<string> {
  let file: some
  try {
    file = await Deno.open(path)
    const hash = deps.hash.createHash(algo)
    for await (const chunk of Deno.iter(file)) hash.update(chunk)
    return encodeBase58(hash.digest())
  } finally {
    if (file) Deno.close(file.rid);
  }
}