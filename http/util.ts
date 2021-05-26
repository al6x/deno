import * as stdpath from "https://deno.land/std/path/mod.ts"
import { p, test, assert, take } from "base/base.ts"
import * as fs from "base/fs.ts"
import * as crypto from "base/crypto.ts"


// assetHash ---------------------------------------------------------------------------------------
export async function assetHashSlow(path: string, assetFilePaths: string[]): Promise<string> {
  if (!path.startsWith("/")) throw new Error(`Path should start with /, ${path}`)
  if (path.includes("..")) throw new Error(`Invalid path, ${path}`)
  for (const assetFilePath in assetFilePaths) {
    let fullPath = stdpath.join(assetFilePath, path)
    if (await fs.exists(fullPath)) {
      return take(await crypto.fileHash(fullPath, "md5"), 6)
    }
  }
  throw new Error(`Asset file not found, ${path}`)
}

const assertHashCache = new Map<string, string>()
const assertHashInProcess = new Map<string, Promise<string>>()

export async function assetHash(path: string, assetFilePaths: string[]): Promise<string> {
  const cached = assertHashCache.get(path)
  if (cached) return cached
  const inProcess = assertHashInProcess.get(path)
  if (inProcess) return inProcess
  try {
    let promise = assetHashSlow(path, assetFilePaths)
    assertHashInProcess.set(path, promise)
    assertHashCache.set(path, await promise)
  } finally {
    assertHashInProcess.delete(path)
  }
  return assertHashCache.get(path)!
}

// var asset_hash_cache: Table[string, string]
// proc asset_hash*(path: string, assets_file_paths: seq[string], max_file_size: int): string =
//   asset_hash_cache.mget(path, () => asset_hash_slow(path, assets_file_paths, max_file_size))