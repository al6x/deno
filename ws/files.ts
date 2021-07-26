import { p, last, assert, slowTest } from "base/base.ts"
import { Log } from "base/log.ts"
import * as crypto from "base/crypto.ts"
import * as fs from "base/fs.ts"
import { Db, DbTable, sql } from "../db/db_table.ts"
import { HttpError } from "../http/server.ts"
import { io } from "base/deps.ts"
import { Context, FormDataReadOptions, getRandomFilename } from "./deps.ts"


// Files -------------------------------------------------------------------------------------------
export class Files {
  private readonly log:      Log
  private readonly db_files: DbTable<File>

  constructor(
    public readonly db:          Db,
    public readonly path:        string,
    public readonly tmpDir:      string,
    public readonly maxFileB:    number = 2_097_152,  // 2mb maximum file size,
    public readonly maxPerUserB: number = 16_777_216  // 16mb maximum files size per user
  ) {
    this.log = new Log("Files")
    db.before(sql(create_files_schema), "apply files schema")
    this.db_files = db.table("files", ["user_id", "project_id", "path"], false)
  }

  filePath(user_id: string, project_id: string, path: string): string {
    return this.path + fsPath(user_id, project_id, path)
  }

  async get(user_id: string, project_id: string, path: string): Promise<Uint8Array> {
    this.log
      .with({ user_id, project_id, path })
      .info("get_file {user_id}.{project_id} {path}")
    return fs.readFile(this.filePath(user_id, project_id, path))
  }

  async has(user_id: string, project_id: string, path: string): Promise<boolean> {
    this.log
      .with({ user_id, project_id, path })
      .info("has_file {user_id}.{project_id} {path}")
    return fs.exists(this.filePath(user_id, project_id, path))
  }

  async move(user_id: string, project_id: string, path: string, fromPath: string): Promise<FileInfo> {
    this.log
      .with({ user_id, project_id, path })
      .info("save_file {user_id}.{project_id} {path}")
    const hash = await crypto.fileHash(fromPath, "sha256")

    const fstats = await Deno.stat(fromPath)
    if (!fstats.isFile) throw new Error("internal error, file expected")
    const size_b = fstats.size
    if (size_b > this.maxFileB) throw Error(`file is too big ${size_b}b, max allowed ${this.maxFileB}`)

    const fpath = this.filePath(user_id, project_id, path)
    await fs.move(fromPath, fpath, { overwrite: true })

    const file: File = { user_id, project_id, path, hash, size_b }
    await this.db_files.save(file)
    return { path: file.path, hash: file.hash, size_b: file.size_b }
  }

  async set(user_id: string, project_id: string, path: string, data: Uint8Array): Promise<FileInfo> {
    this.log
      .with({ user_id, project_id, path })
      .info("save_file {user_id}.{project_id} {path}")
    const hash = crypto.hash(data, 'sha256')

    let size_b = data.length
    if (size_b > this.maxFileB) throw Error(`file is too big ${size_b}b, max allowed ${this.maxFileB}`)

    const fpath = this.filePath(user_id, project_id, path)
    await fs.writeFile(fpath, data)

    const file: File = { user_id, project_id, path, hash, size_b }
    await this.db_files.save(file)
    return { path: file.path, hash: file.hash, size_b: file.size_b }
  }

  async del(user_id: string, project_id: string, path: string): Promise<FileInfo | undefined> {
    this.log
      .with({ user_id, project_id, path })
      .info("del_file {user_id}.{project_id} {path}")

    const found = await this.db_files.fget({ user_id, project_id, path })
    this.db_files.del({ user_id, project_id, path })

    const fpath = this.filePath(user_id, project_id, path)
    await fs.remove(fpath, { deleteEmptyParents: true })
    return found
  }

  async all(user_id: string, project_id: string): Promise<FileInfo[]> {
    this.log
      .with({ user_id, project_id })
      .info("get_files {user_id}.{project_id}")
    return (await this.db_files.filter({ user_id, project_id }))
      .map((f) => ({ path: f.path, hash: f.hash, size_b: f.size_b }))
  }

  protected tmpDirCreated = false
  async ensureTmpDirCreated(): Promise<void> {
    if (this.tmpDirCreated) return
    await fs.createDirectory(this.tmpDir)
    this.tmpDirCreated = true
  }

  buildMultipartUploadHandler(): (user_id: string, project_id: string, ctx: Context) => Promise<FileInfo[]> {
    const uploadOptions: FormDataReadOptions = {
      // The size of the buffer to read from the request body at a single time
      bufferSize:  262_144,
      maxFileSize: this.maxFileB,
      outPath:     this.tmpDir      // Path to store temporary files, Deno.makeTempDir()
    }
    return async (user_id, project_id, ctx) => {
      await this.ensureTmpDirCreated()

      const body = await ctx.request.body({ type: 'form-data'})
      const data = await body.value.read(uploadOptions)
      const files: FileInfo[] = []
      for (const file of (data.files || [])) {
        if (!file.filename) throw new Error("no filename")
        files.push(await this.move(user_id, project_id, file.name, file.filename))
      }

      return files
    }
  }

  buildUploadHandler(): (user_id: string, project_id: string, ctx: Context) => Promise<FileInfo> {
    const bufferSizeB = 262_144

    return async (user_id, project_id, ctx) => {
      await this.ensureTmpDirCreated()

      const body = ctx.request.body({ type: "reader" }).value
      let tmpFilePath: string | undefined, tmpFile: Deno.File | undefined
      try {
        tmpFilePath = `${this.tmpDir}/${getRandomFilename("upload_", "tmp")}`
        tmpFile = await Deno.open(tmpFilePath, { write: true, createNew: true })

        let n = 0, totalB = 0, buff = new Uint8Array(bufferSizeB)
        do {
          // Deno.writeAll()
          buff = buff.length < bufferSizeB ? new Uint8Array(bufferSizeB) : buff
          n = await body.read(buff) || 0
          buff = n != buff.length ? buff.slice(0, n) : buff

          totalB += n
          if (totalB > this.maxFileB) throw new HttpError("max file size limit exceeded")
          await io.writeAll(tmpFile, buff)
        } while (n > 0)
        // await tmpFile.truncate(totalB)

        const path = ctx.request.url.pathname
        return await this.move(user_id, project_id, path, tmpFilePath)
      } finally {
        if (tmpFile) Deno.close(tmpFile.rid)
        if (tmpFilePath) fs.remove(tmpFilePath)
      }
    }
  }
}

function fsPath(user_id: string, project_id: string, path: string): string {
  if (!/^[a-z0-9_\-]+$/i.test(project_id)) throw new Error("invalid characters in project_id")
  if (path.length > 200) throw new Error("path is too long")
  if (!path.startsWith("/")) throw new Error("path should start with /")
  if ((path.match(/\//g) || []).length > 5) throw new Error("too many parts in path")
  if (!/^[a-z0-9_\-\/\.]+$/i.test(path)) throw new Error("invalid characters in path")
  return `/${user_id}/${project_id}${path}`
}


// File --------------------------------------------------------------------------------------------
export interface FileInfo {
  path:   string
  hash:   string
  size_b: number
}

interface File {
  user_id:    string
  project_id: string
  path:       string
  hash:       string
  size_b:     number
}

const create_files_schema = `
  create table if not exists files(
    user_id     varchar(100) not null,
    project_id  varchar(100) not null,
    path        varchar(256) not null,
    hash        varchar(100) not null,
    size_b      integer      not null,

    primary key (user_id, project_id, path)
  );

  create index if not exists files_user_id            on files (user_id);
  create index if not exists files_user_id_project_id on files (user_id, project_id);
  create index if not exists files_hash               on files (hash);
`


// Test --------------------------------------------------------------------------------------------
// test=Files deno run --import-map=import_map.json --unstable --allow-all ws/files.ts
slowTest("Files", async () => {
  const db = new Db("deno_unit_tests")

  const files = new Files(db, "./tmp/files_test/files", "./tmp/files_test/tmp")

  function tou8a(s: string) { return new TextEncoder().encode(s) }

  await files.set("alex", "plot", "/index.html", tou8a("some html"))
  await files.set("alex", "plot", "/scripts/script.js", tou8a("some js"))

  assert.equal(await files.get("alex", "plot", "/index.html"), tou8a("some html"))
  assert.equal(await files.get("alex", "plot", "/scripts/script.js"), tou8a("some js"))

  await files.del("alex", "plot", "/scripts/script.js")
  let found: string
  try {
    await files.get("alex", "plot", "/scripts/script.js")
    found = "found"
  } catch {
    found = "not found"
  }
  assert.equal(found, "not found")

  assert.equal((await files.all("alex", "plot")).map((f) => f.path), ["/index.html"])

  await db.close()
})