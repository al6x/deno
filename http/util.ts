import "base/base.ts"
import * as fs from "base/fs.ts"
import * as crypto from "base/crypto.ts"
import * as stdpath from "./deps.ts"


// assetHash ---------------------------------------------------------------------------------------
export async function assetHashSlow(path: string, assetFilePaths: string[]): Promise<string> {
  if (!path.startsWith("/")) throw new Error(`Path should start with /, ${path}`)
  if (path.includes("..")) throw new Error(`Invalid path, ${path}`)
  for (const assetFilePath of assetFilePaths) {
    let fullPath = stdpath.join(assetFilePath, path)
    if (await fs.exists(fullPath)) {
      return (await crypto.file_hash(fullPath, "md5")).take(6)
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


// assetFilePath ---------------------------------------------------------------------------------------
export async function assetFilePathSlow(path: string, assetFilePaths: string[]): Promise<E<string>> {
  if (!path.startsWith("/")) throw new Error(`Path should start with /, ${path}`)
  if (path.includes("..")) throw new Error(`Invalid path, ${path}`)
  for (const assetFilePath of assetFilePaths) {
    let fullPath = stdpath.join(assetFilePath, path)
    if (await fs.exists(fullPath)) return { is_error: false, value: fullPath }
  }
  return { is_error: true, message: `Asset file not found, ${path}` }
}

const assertPathCache = new Map<string, E<string>>()
const assertPathInProcess = new Map<string, Promise<E<string>>>()

export async function assetFilePath(path: string, assetFilePaths: string[]): Promise<E<string>> {
  const cached = assertPathCache.get(path)
  if (cached) return cached
  const inProcess = assertPathInProcess.get(path)
  if (inProcess) return inProcess
  try {
    let promise = assetFilePathSlow(path, assetFilePaths)
    assertPathInProcess.set(path, promise)
    let found = await promise
    if (found.is_error) return found // Not setting cache if it's not found, to avoid memory leak
    assertPathCache.set(path, found)
  } finally {
    assertPathInProcess.delete(path)
  }
  return assertPathCache.get(path)!
}

// // var asset_hash_cache: Table[string, string]
// // proc asset_hash*(path: string, assets_file_paths: seq[string], max_file_size: int): string =
// //   asset_hash_cache.mget(path, () => asset_hash_slow(path, assets_file_paths, max_file_size))