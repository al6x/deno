import { something, assert, p, ensure_error, stable_json_stringify } from './base.ts'
import * as deno_path from 'https://deno.land/std/path/mod.ts'
import * as deno_fs from 'https://deno.land/std/fs/mod.ts'

export type EntryType = 'directory' | 'file' // | 'link'
export type Entry = { type: EntryType, name: string, path: string }


// resolve -----------------------------------------------------------------------------------------
export function resolve(...paths: string[]): string { return deno_path.resolve(...paths) }


// read_directory ----------------------------------------------------------------------------------
export async function read_directory(path: string, filter?: (entry: Entry) => boolean): Promise<Entry[]> {
  const entries: Entry[] = []
  for await (let entry of deno_fs.walk(path, { maxDepth: 1 })) {
    let type: EntryType
    if (entry.isFile)           type = 'file'
    else if (entry.isDirectory) type = 'directory'
    else                        throw new Error("symlink type is not supported")
    entries.push({ type, name: entry.name, path: deno_path.resolve(path, entry.name) })
  }
  return filter ? entries.filter(filter) : entries
}


// read_file ---------------------------------------------------------------------------------------
function read_file(path: string): Promise<Uint8Array>
function read_file(path: string, options: { encoding: string }): Promise<string>
async function read_file(path: string, options?: something) {
  const buffer = await Deno.readFile(path)
  if (options) {
    const decoder = new TextDecoder(options.encoding)
    return decoder.decode(buffer)
  } else return buffer
}
export { read_file }


// read_file_sync ----------------------------------------------------------------------------------
function read_file_sync(path: string): Uint8Array
function read_file_sync(path: string, options: { encoding: string }): string
function read_file_sync(path: string, options?: something) {
  const buffer = Deno.readFileSync(path)
  if (options) {
    const decoder = new TextDecoder(options.encoding)
    return decoder.decode(buffer)
  } else return buffer
}
export { read_file_sync }


// write_file --------------------------------------------------------------------------------------
// Creates parent directories if they aren't existing
export async function write_file(
  path:     string,
  data:     string | Uint8Array
): Promise<void> { return write_file_impl(path, data, false) }

async function write_file_impl(
  path:   string,
  data:   string | Uint8Array,
  append: boolean
): Promise<void> {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    Deno.writeFileSync(path, buffer, { append })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = deno_path.dirname(path)
    if (!await exists(dirname)) {
      await deno_fs.ensureDir(dirname)
      Deno.writeFileSync(path, buffer, { append })
    } else throw e
  }
}


// write_file_sync ---------------------------------------------------------------------------------
export function write_file_sync(
  path:     string,
  data:     string | Uint8Array
): void {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    Deno.writeFileSync(path, buffer)
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = deno_path.dirname(path)
    if (!deno_fs.existsSync(dirname)) {
      deno_fs.ensureDirSync(dirname)
      Deno.writeFileSync(path, buffer)
    } else throw e
  }
}


// append_to_file ----------------------------------------------------------------------------------
// Creates parent directory automatically
export async function append_to_file(
  path:     string,
  data:     string | Uint8Array
): Promise<void> { write_file_impl(path, data, true) }


// read_json ---------------------------------------------------------------------------------------
export async function read_json<T = something>(path: string): Promise<T> {
  return JSON.parse(await read_file(path, { encoding: 'utf8' }))
}


// write_json --------------------------------------------------------------------------------------
export async function write_json<T>(path: string, data: T): Promise<void> {
  await write_file(path, stable_json_stringify(data))
}

// rename ------------------------------------------------------------------------------------------
// Creates parent directories automatically for destination
export async function rename(from: string, to: string, options?: { overwrite?: boolean }): Promise<void> {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  try {
    await deno_fs.move(from, to, { overwrite })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const to_dirname = deno_path.dirname(to)
    if (!await exists(to_dirname)) {
      await deno_fs.ensureDir(to_dirname)
      await deno_fs.move(from, to, { overwrite })
    } else throw e
  }
}


// copy --------------------------------------------------------------------------------------------
// Copy file or directory, creates parent directories automatically for destination
export async function copy(from: string, to: string, options?: { overwrite?: boolean }): Promise<void> {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  try {
    await deno_fs.copy(from, to, { overwrite })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const to_dirname = deno_path.dirname(to)
    if (!await exists(to_dirname)) {
      await deno_fs.ensureDir(to_dirname)
      await deno_fs.copy(from, to, { overwrite })
    } else throw e
  }
}


// create_directory --------------------------------------------------------------------------------
// Creates parent directory automatically
export async function create_directory(path: string): Promise<void> { await deno_fs.ensureDir(path) }


// exists ------------------------------------------------------------------------------------------
export async function exists(path: string): Promise<boolean> { return deno_fs.exists(path) }


// exists_sync -------------------------------------------------------------------------------------
export function exists_sync(path: string): boolean { return deno_fs.existsSync(path) }


// remove ------------------------------------------------------------------------------------------
// Deletes file or directory, does nothing if path not exist
export async function remove(path: string, options?: { recursive?: boolean }): Promise<void> {
  options = options || {}
  const recursive = 'recursive' in options ? options.recursive : false
  try {
    await Deno.remove(path, { recursive })
  } catch (e) {
    // Ignoring exception if path doesn't exist
    if (await exists(path)) throw e
  }
}


// is_tmp_directory --------------------------------------------------------------------------------
export function is_tmp_directory(path: string): boolean {
  return /tmp|temp/i.test(path.toLowerCase())
}
export const not_tmp_directory_message = `temp directory expected to have 'tmp' or 'temp' term in its path`


// delete_tmp_directory ----------------------------------------------------------------------------
export async function remove_tmp_directory(path: string): Promise<void> {
  // Checking if it's tmp for safety, so you don't accidentally delete non tmp directory.
  assert(is_tmp_directory(path), not_tmp_directory_message)
  await remove(path, { recursive: true })
}


// create_tmp_directory ----------------------------------------------------------------------------
export async function create_tmp_directory(prefix: string): Promise<string> {
  return Deno.makeTempDir({ prefix })
}


// get_type ----------------------------------------------------------------------------------------
export async function get_type(path: string): Promise<EntryType> {
  const stat = await Deno.stat(path)
  if      (stat.isFile)         return 'file'
  else if (stat.isDirectory)    return 'directory'
  else
    throw new Error(`usnupported fs entry type '${JSON.stringify(stat)}' for '${path}'`)
}


// Testing -----------------------------------------------------------------------------------------
// p(await read_directory('.'))
// p(await read_file('./fs.ts', { encoding: 'utf-8' }))
// p(await write_file('./tmp/write_test.txt', 'some content'))