import { p, last, assert } from "base/base.ts"
import { Log } from "base/log.ts"
import * as fs from "base/fs.ts"
import { Db } from "./db.ts"
import { encodeBase58, decodeBase58 } from "base/base58.js"
import { createHash } from "https://deno.land/std/hash/mod.ts"


// Files -------------------------------------------------------------------------------------------
export class Files {
  private readonly log: Log

  constructor(
    public readonly path:           string,
    public readonly db:             Db,
    public readonly max_object_b:   number = 2_000_000,
    public readonly max_per_user_b: number = 10_000_000
  ) {
    this.log = new Log("Files", last(path.split("/")))
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

  async setFile(user_id: string, project_id: string, path: string, hash: string, data: Uint8Array): Promise<void> {
    this.log
      .with({ user_id, project_id, path, hash })
      .info("save_file {user_id}.{project_id} {path}")
    let vhash = sha256(data)
    if (hash != vhash) throw new Error(`hash is wrong, should be base58 hash '${vhash}'`)

    let fpath = this.filePath(user_id, project_id, path)
    await fs.writeFile(fpath, data)

    await this.db.exec(`
      insert into files
        (user_id, project_id, path, hash, size_b)
      values
        ($1,      $2,         $3,   $4,   $5)
      on conflict (user_id, project_id, path) do update
      set
        hash = excluded.hash, size_b = excluded.size_b
      `,
      [user_id, project_id, path, hash, data.length],
      (log) => {
        log
          .with({ user_id, project_id, path, hash })
          .info("save {user_id}.{project_id} {path}")
      }
    )
  }

  async delFile(user_id: string, project_id: string, path: string): Promise<void> {
    this.log
      .with({ user_id, project_id, path })
      .info("del_file {user_id}.{project_id} {path}")

    await this.db.exec(
      `delete from files where user_id = $1 and project_id = $2 and path = $3`,
      [user_id, project_id, path],
      (log) => {
        log
          .with({ user_id, project_id, path })
          .info("delete {user_id}.{project_id} {path}")
      }
    )
    let fpath = this.filePath(user_id, project_id, path)
    await fs.remove(fpath, { deleteEmptyParents: true })
  }

  async getFiles(user_id: string, project_id: string): Promise<File[]> {
    this.log
      .with({ user_id, project_id })
      .info("get_files {user_id}.{project_id}")
    let rows = await this.db.exec<[string, string, string, string, number]>(`
      select user_id, project_id, path, hash, size_b
      from   files
      where  user_id = $1 and project_id = $2`,
      [user_id, project_id],
      (log) => {
        log
          .with({ user_id, project_id })
          .info("get files {user_id}.{project_id}")
      }
    )
    return rows
      .map(([user_id, project_id, path, hash, size_b]) => ({user_id, project_id, path, hash, size_b}))
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

let create_files_schema = `
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


function sha256(data: Uint8Array | string): string {
  const hash = createHash("sha256")
  hash.update(data)
  return encodeBase58(hash.digest())
}


// Test --------------------------------------------------------------------------------------------
// deno run --import-map=import_map.json --unstable --allow-net --allow-read="./tmp" \
// --allow-write="./tmp" ws/files.ts
if (import.meta.main) {
  const db = new Db("nim_test")
  await db.exec(create_files_schema, (log) => log.info("creating files schema"))

  const files = new Files("./tmp/files_test", db)

  function tou8a(s: string) { return new TextEncoder().encode(s) }

  await files.setFile("alex", "plot", "/index.html", sha256("some html"), tou8a("some html"))
  await files.setFile("alex", "plot", "/scripts/script.js", sha256("some js"), tou8a("some js"))

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
}