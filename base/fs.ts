import { some, assert, p, ensureError, toJson } from './base.ts'
import * as denoPath from 'https://deno.land/std/path/mod.ts'
import * as denoFs from 'https://deno.land/std/fs/mod.ts'

export type EntryType = 'directory' | 'file' // | 'link'
export type Entry = { type: EntryType, name: string }


// resolve -----------------------------------------------------------------------------------------
// export function resolve(...paths: string[]): string { return denoPath.resolve(...paths) }


// readDirectory ----------------------------------------------------------------------------------
// Use `Deno.readDir` as `denoFs.walk` is slow
// export async function readDirectory(path: string, filter?: (entry: Entry) => boolean): Promise<Entry[]> {
//   const entries: Entry[] = []
//   for await (let entry of denoFs.walk(path, { maxDepth: 1 })) {
//     let type: EntryType
//     if (entry.isFile)           type = 'file'
//     else if (entry.isDirectory) type = 'directory'
//     else                        throw new Error("symlink type is not supported")
//     entries.push({ type, name: entry.name }) // , path: denoPath.resolve(path, entry.name)
//   }
//   return filter ? entries.filter(filter) : entries
// }


// readFile ---------------------------------------------------------------------------------------
function readFile(path: string): Promise<Uint8Array>
function readFile(path: string, options: { encoding: string }): Promise<string>
async function readFile(path: string, options?: some) {
  const buffer = await Deno.readFile(path)
  if (options) {
    const decoder = new TextDecoder(options.encoding)
    return decoder.decode(buffer)
  } else return buffer
}
export { readFile }


// readFileSync ----------------------------------------------------------------------------------
function readFileSync(path: string): Uint8Array
function readFileSync(path: string, options: { encoding: string }): string
function readFileSync(path: string, options?: some) {
  const buffer = Deno.readFileSync(path)
  if (options) {
    const decoder = new TextDecoder(options.encoding)
    return decoder.decode(buffer)
  } else return buffer
}
export { readFileSync }


// writeFile --------------------------------------------------------------------------------------
// Creates parent directories if they aren't existing
export async function writeFile(
  path:     string,
  data:     string | Uint8Array
) { return writeFileImpl(path, data, false) }

async function writeFileImpl(
  path:   string,
  data:   string | Uint8Array,
  append: boolean
) {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    Deno.writeFileSync(path, buffer, { append })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = denoPath.dirname(path)
    if (!await exists(dirname)) {
      await denoFs.ensureDir(dirname)
      Deno.writeFileSync(path, buffer, { append })
    } else throw e
  }
}


// writeFileSync ---------------------------------------------------------------------------------
export function writeFileSync(
  path:     string,
  data:     string | Uint8Array
): void {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    Deno.writeFileSync(path, buffer)
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = denoPath.dirname(path)
    if (!denoFs.existsSync(dirname)) {
      denoFs.ensureDirSync(dirname)
      Deno.writeFileSync(path, buffer)
    } else throw e
  }
}


// appendToFile ----------------------------------------------------------------------------------
// Creates parent directory automatically
export async function appendToFile(
  path:     string,
  data:     string | Uint8Array
) { writeFileImpl(path, data, true) }


// readJson ---------------------------------------------------------------------------------------
export async function readJson<T = some>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, { encoding: 'utf8' }))
}


// writeJson --------------------------------------------------------------------------------------
export async function writeJson<T>(path: string, data: T) {
  await writeFile(path, toJson(data))
}

// rename ------------------------------------------------------------------------------------------
// Creates parent directories automatically for destination
export async function move(from: string, to: string, options?: { overwrite?: boolean }) {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  try {
    await denoFs.move(from, to, { overwrite })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const toDirname = denoPath.dirname(to)
    if (!await exists(toDirname)) {
      await denoFs.ensureDir(toDirname)
      await denoFs.move(from, to, { overwrite })
    } else throw e
  }
}


// copy --------------------------------------------------------------------------------------------
// Copy file or directory, creates parent directories automatically for destination
export async function copy(from: string, to: string, options?: { overwrite?: boolean }) {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  try {
    await denoFs.copy(from, to, { overwrite })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const toDirname = denoPath.dirname(to)
    if (!await exists(toDirname)) {
      await denoFs.ensureDir(toDirname)
      await denoFs.copy(from, to, { overwrite })
    } else throw e
  }
}


// createDirectory --------------------------------------------------------------------------------
// Creates parent directory automatically
export async function createDirectory(path: string) { await denoFs.ensureDir(path) }


// exists ------------------------------------------------------------------------------------------
export async function exists(path: string): Promise<boolean> { return denoFs.exists(path) }


// existsSync --------------------------------------------------------------------------------------
export function existsSync(path: string): boolean { return denoFs.existsSync(path) }


// isEmpty -----------------------------------------------------------------------------------------
export async function isEmpty(path: string): Promise<boolean> {
  for await (let _entry of Deno.readDir(path)) {
    return false
  }
  return true
}

// remove ------------------------------------------------------------------------------------------
// Deletes file or directory, does nothing if path not exist
export async function remove(
  path: string,
  options?: { recursive?: boolean, deleteEmptyParents?: boolean }
) {
  options = options || {}
  const recursive = 'recursive' in options ? options.recursive : false
  let success = false
  try {
    await Deno.remove(path, { recursive })
    success = true
  } catch (e) {
    // Ignoring exception if path doesn't exist
    if (await exists(path)) throw e
  }

  if (success && options.deleteEmptyParents) {
    const dirname = denoPath.dirname(path)
    if (await isEmpty(dirname)) {
      await remove(dirname, { deleteEmptyParents: true })
    }
  }
}


// isTmpDirectory --------------------------------------------------------------------------------
export function isTmpDirectory(path: string): boolean {
  return /tmp|temp/i.test(path.toLowerCase())
}
export const notTmpDirectoryMessage = `temp directory expected to have 'tmp' or 'temp' term in its path`


// delete_tmp_directory ----------------------------------------------------------------------------
export async function removeTmpDirectory(path: string) {
  // Checking if it's tmp for safety, so you don't accidentally delete non tmp directory.
  assert(isTmpDirectory(path), notTmpDirectoryMessage)
  await remove(path, { recursive: true })
}


// createTmpDirectory ----------------------------------------------------------------------------
export async function createTmpDirectory(prefix: string): Promise<string> {
  return Deno.makeTempDir({ prefix })
}


// getType ----------------------------------------------------------------------------------------
export async function getType(path: string): Promise<EntryType> {
  const stat = await Deno.stat(path)
  if      (stat.isFile)         return 'file'
  else if (stat.isDirectory)    return 'directory'
  else
    throw new Error(`usnupported fs entry type '${JSON.stringify(stat)}' for '${path}'`)
}


// Testing -----------------------------------------------------------------------------------------
// p(await readDirectory('.'))
// p(await readFile('./fs.ts', { encoding: 'utf-8' }))
// p(await writeFile('./tmp/write_test.txt', 'some content'))