import './base.ts'
import * as deps from './deps.ts'

export type EntryType = 'directory' | 'file' // | 'link'
export type Entry = { type: EntryType, name: string }


// resolve -----------------------------------------------------------------------------------------
export function resolve(...paths: string[]): string { return deps.path.resolve(...paths) }


// read_dir ----------------------------------------------------------------------------------
export async function read_dir(path: string, filter?: (entry: Entry) => boolean): Promise<Entry[]> {
  const entries: Entry[] = []
  for await (const entry of Deno.readDir(path)) {
    let type: EntryType
    if (entry.isFile)           type = 'file'
    else if (entry.isDirectory) type = 'directory'
    else                        throw new Error("todo symlink not implemented")
    entries.push({ type, name: entry.name })
  }
  return filter ? entries.filter(filter) : entries
}


// read_file ---------------------------------------------------------------------------------------
function read_file(path: string): Promise<Uint8Array>
function read_file(path: string, options: { encoding: string }): Promise<string>
async function read_file(path: string, options?: any) {
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
function read_file_sync(path: string, options?: any) {
  const buffer = Deno.readFileSync(path)
  if (options) {
    const decoder = new TextDecoder(options.encoding)
    return decoder.decode(buffer)
  } else return buffer
}
export { read_file_sync }


// write_file --------------------------------------------------------------------------------------
// Creates parent directories if they aren't existing
export async function write_file(path: string, data: string | Uint8Array): Promise<void> {
  return write_file_impl(path, data, false)
}

async function write_file_impl(
  path:   string,
  data:   string | Uint8Array,
  append: boolean
): Promise<void> {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    await Deno.writeFile(path, buffer, { append })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = deps.path.dirname(path)
    if (!await exists(dirname)) {
      await deps.fs.ensureDir(dirname)
      await Deno.writeFile(path, buffer, { append })
    } else throw e
  }
}


// write_file_sync ---------------------------------------------------------------------------------
export function write_file_sync(path: string, data: string | Uint8Array): void {
  let buffer: Uint8Array = data instanceof Uint8Array ? data : (new TextEncoder()).encode(data)
  try {
    Deno.writeFileSync(path, buffer)
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const dirname = deps.path.dirname(path)
    if (!deps.fs.existsSync(dirname)) {
      deps.fs.ensureDirSync(dirname)
      Deno.writeFileSync(path, buffer)
    } else throw e
  }
}


// appendToFile ----------------------------------------------------------------------------------
// Creates parent directory automatically
export async function appendToFile(
  path:     string,
  data:     string | Uint8Array
) { write_file_impl(path, data, true) }


// read_json ---------------------------------------------------------------------------------------
export async function read_json<T = any>(path: string): Promise<T> {
  return JSON.parse(await read_file(path, { encoding: 'utf8' }))
}


// write_json --------------------------------------------------------------------------------------
export async function write_json<T>(path: string, data: T) {
  await write_file(path, to_json(data))
}

// rename ------------------------------------------------------------------------------------------
// Creates parent directories automatically for destination
export async function move(
  from: string, to: string, options?: { overwrite?: boolean, deleteEmptyParents?: boolean }
) {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  let success = false
  try {
    await deps.fs.move(from, to, { overwrite })
    success = true
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const toDirname = deps.path.dirname(to)
    if (!await exists(toDirname)) {
      await deps.fs.ensureDir(toDirname)
      await deps.fs.move(from, to, { overwrite })
    } else throw e
  }

  if (success && options.deleteEmptyParents) {
    const dirname = deps.path.dirname(from)
    if (await is_empty(dirname)) {
      await remove(dirname, { deleteEmptyParents: true })
    }
  }
}


// copy --------------------------------------------------------------------------------------------
// Copy file or directory, creates parent directories automatically for destination
export async function copy(from: string, to: string, options?: { overwrite?: boolean }) {
  options = options || {}
  const overwrite = 'overwrite' in options ? options.overwrite : false
  try {
    await deps.fs.copy(from, to, { overwrite })
  } catch (e) {
    // Checking if parent dirs exists, creating it and retrying
    const toDirname = deps.path.dirname(to)
    if (!await exists(toDirname)) {
      await deps.fs.ensureDir(toDirname)
      await deps.fs.copy(from, to, { overwrite })
    } else throw e
  }
}


// create_dir --------------------------------------------------------------------------------
// Creates parent directory automatically
export async function create_dir(path: string) { await deps.fs.ensureDir(path) }


// exists ------------------------------------------------------------------------------------------
export async function exists(path: string): Promise<boolean> { return deps.fs.exists(path) }


// exists_sync --------------------------------------------------------------------------------------
export function exists_sync(path: string): boolean { return deps.fs.existsSync(path) }


// is_empty -----------------------------------------------------------------------------------------
export async function is_empty(path: string): Promise<boolean> {
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
    const dirname = deps.path.dirname(path)
    if (await is_empty(dirname)) {
      await remove(dirname, { deleteEmptyParents: true })
    }
  }
}


// is_tmp_dir --------------------------------------------------------------------------------
export function is_tmp_dir(path: string): boolean {
  return /tmp|temp|\/T\//i.test(path.toLowerCase())
}
export const notTmpDirectoryMessage = `temp directory expected to have 'tmp' or 'temp' term in its path`


// delete_tmp_directory ----------------------------------------------------------------------------
export async function remove_mp_dir(path: string) {
  // Checking if it's tmp for safety, so you don't accidentally delete non tmp directory.
  assert(is_tmp_dir(path), notTmpDirectoryMessage)
  await remove(path, { recursive: true })
}


// create_tmp_dir ----------------------------------------------------------------------------
export async function create_tmp_dir(prefix: string): Promise<string> {
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
// p(await read_dir('.'))
// p(await read_file('./fs.ts', { encoding: 'utf-8' }))
// p(await write_file('./tmp/write_test.txt', 'some content'))