import { p, last, assert, test } from "base/base.ts"
import { Log } from "base/log.ts"
import * as crypto from "base/crypto.ts"
import * as fs from "base/fs.ts"
import { Db, DbTable, sql } from "db/db_table.ts"


// Files -------------------------------------------------------------------------------------------
export class Files {
  private readonly log:      Log
  private readonly db_files: DbTable<File>

  constructor(
    public readonly path:           string,
    public readonly db:             Db,
    public readonly max_object_b:   number = 2_000_000,
    public readonly max_per_user_b: number = 10_000_000
  ) {
    this.log = new Log("Files", last(path.split("/")))
    db.before(sql(create_files_schema))
    this.db_files = db.table("files", ["user_id", "project_id", "path"], false)
  }

  filePath(user_id: string, project_id: string, path: string): string {
    return this.path + fsPath(user_id, project_id, path)
  }

  async getFile(user_id: string, project_id: string, path: string): Promise<Uint8Array> {
    this.log
      .with({ user_id, project_id, path })
      .info("get_file {user_id}.{project_id} {path}")
    return fs.readFile(this.filePath(user_id, project_id, path))
  }

  async hasFile(user_id: string, project_id: string, path: string): Promise<boolean> {
    this.log
      .with({ user_id, project_id, path })
      .info("has_file {user_id}.{project_id} {path}")
    return fs.exists(this.filePath(user_id, project_id, path))
  }

  async setFile(user_id: string, project_id: string, path: string, hash: string, data: Uint8Array) {
    this.log
      .with({ user_id, project_id, path, hash })
      .info("save_file {user_id}.{project_id} {path}")
    const vhash = crypto.hash(data, 'sha256')
    if (hash != vhash) throw new Error(`hash is wrong, should be base58 hash '${vhash}'`)

    const fpath = this.filePath(user_id, project_id, path)
    await fs.writeFile(fpath, data)

    const file: File = { user_id, project_id, path, hash, size_b: data.length }
    await this.db_files.save(file)
  }

  async delFile(user_id: string, project_id: string, path: string) {
    this.log
      .with({ user_id, project_id, path })
      .info("del_file {user_id}.{project_id} {path}")

    this.db_files.del({ user_id, project_id, path })

    const fpath = this.filePath(user_id, project_id, path)
    await fs.remove(fpath, { deleteEmptyParents: true })
  }

  getFiles(user_id: string, project_id: string): Promise<File[]> {
    this.log
      .with({ user_id, project_id })
      .info("get_files {user_id}.{project_id}")
    return this.db_files.filter({ user_id, project_id })
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
test("Files", async () => {
  const db = new Db("default", "deno_unit_tests")
  // await db.exec(create_files_schema, (log) => log.info("creating files schema"))

  const files = new Files("./tmp/files_test", db)

  function tou8a(s: string) { return new TextEncoder().encode(s) }

  await files.setFile("alex", "plot", "/index.html", crypto.hash("some html", 'sha256'), tou8a("some html"))
  await files.setFile("alex", "plot", "/scripts/script.js", crypto.hash("some js", 'sha256'), tou8a("some js"))

  assert.equal(await files.getFile("alex", "plot", "/index.html"), tou8a("some html"))
  assert.equal(await files.getFile("alex", "plot", "/scripts/script.js"), tou8a("some js"))

  await files.delFile("alex", "plot", "/scripts/script.js")
  let found: string
  try {
    await files.getFile("alex", "plot", "/scripts/script.js")
    found = "found"
  } catch {
    found = "not found"
  }
  assert.equal(found, "not found")

  assert.equal((await files.getFiles("alex", "plot")).map((f) => f.path), ["/index.html"])

  await db.close()
}, true)