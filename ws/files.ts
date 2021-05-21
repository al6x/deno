// import base/[basem, asyncm, urlm, logm, jsonm]
// from base/fs import nil
// import postgres/db_tablem
// from nimsha2 import nil
// from os import sleep

// export urlm


// Files -------------------------------------------------------------------------------------------
export class Files {
  constructor(
    public readonly id: string
  ) {}
}

// proc init*(_: type[Files], id = "default"): Files =
//   Files(id: id)

// proc `$`*(ps: Files): string = ps.id
// proc hash*(ps: Files): Hash = ps.id.hash
// proc `==`*(a, b: Files): bool = a.id == b.id

// proc log(ps: Files): Log = Log.init("Files", ps.id)


// # File -----------------------------------------------------------------------------------------
// type
//   File = object
//     user_id:    string
//     project_id: string
//     path:       string
//     hash:       string
//     size_b:     int

//   # FileDeleteEvent = object
//   #   hash: string

// let before_sql = sql"""
//   create table if not exists files(
//     user_id     varchar(100) not null,
//     project_id  varchar(100) not null,
//     path        varchar(256) not null,
//     hash        varchar(100) not null,
//     size_b      integer      not null,

//     primary key (user_id, project_id, path)
//   );

//   create index if not exists files_user_id            on files (user_id);
//   create index if not exists files_user_id_project_id on files (user_id, project_id);
//   create index if not exists files_hash               on files (hash);


//   -- create table if not exists file_delete_events(
//   --   hash varchar(100) not null
//   -- );

//   -- create index if not exists file_delete_events_hash  on file_delete_events (hash);
// """


// # FilesImpl ----------------------------------------------------------------------------------------
// type
//   FilesImpl = ref object
//     path:           string
//     max_object_b:   int
//     max_per_user_b: int
//     db:             Db

//     db_files:              DbTable[File]
//     # db_file_delete_events: DbTable[FileDeleteEvent]

// var impls: Table[Files, FilesImpl]


// # impl ---------------------------------------------------------------------------------------------
// proc impl*(
//   files:           Files,
//   path:            string,
//   max_object_b   = 2_000_000,
//   max_per_user_b = 10_000_000,
//   db             = Db.init("default")
// ): void =
//   let db_files = db.table(File, "files", ids = @["user_id", "project_id", "path"], auto_id = false)
//   # let db_file_delete_events = db.table(FileDeleteEvent, "file_delete_events", ids = @[], auto_id = false)

//   db.before before_sql

//   impls[files] = FilesImpl(path: path, max_object_b: max_object_b, max_per_user_b: max_per_user_b, db: db,
//     db_files: db_files
//     # , db_file_delete_events: db_file_delete_events
//   )

// proc impl(files: Files): FilesImpl =
//   if files notin impls: throw fmt"files '{files}' not defined"
//   impls[files]


// # fs -----------------------------------------------------------------------------------------------
// proc fs_path(user_id, project_id, path: string): string =
//   if re"(?i)^[a-z0-9_\-]+$" !~ project_id: throw "invalid characters in project_id"
//   if path.len > 200: throw "path is too long"
//   if not path.starts_with "/": throw "path should start with /"
//   if path.count("/") > 5: throw "too many parts in path"
//   if re"(?i)^[a-z0-9_\-\/\.]+$" !~ path: throw "invalid characters in path"
//   fmt"/{user_id}/{project_id}/{path}"

// # proc fs_write_file_if_not_exist(user_id, db_path, hash, data: string): void =
// #   let file_path = db_path & hash.fs_path
// #   if fs.exist(file_path): return

// #   let tmp_path = db_path & fs_tmp_path(user_id, hash)
// #   fs.write(tmp_path, data)
// #   fs.move(tmp_path, file_path)

// # proc fs_delete_file(db_path, hash: string): void =
// #   let file_path = db_path & hash.fs_path
// #   fs.delete(file_path)


// # has_file_content ---------------------------------------------------------------------------------
// # proc has_file_content*(files: Files, hash: string): bool =
// #   files.log.with()
// #   fs.exist(files.impl.path & hash.fs_path)


// # get_file -----------------------------------------------------------------------------------------
// # proc get_file*(files: Files, user_id, project_id, path: string, log = true): Option[File] =
// #   if log:
// #     files.log
// #       .with((user_id: user_id, project_id: project_id, path: path))
// #       .info("get_file {user_id}/{project_id}{path}")
// #   files.impl.db_files.fget((user_id: user_id, project_id: project_id, path: path))


// # get_file -----------------------------------------------------------------------------------------
// proc get_file*(files: Files, user_id, project_id, path: string): string =
//   files.log
//     .with((user_id: user_id, project_id: project_id, path: path))
//     .info("get_file_content {user_id}.{project_id} {path}")
//   # let impl = files.impl
//   # let found = impl.db_files.fget((user_id: user_id, project_id: project_id, path: path))
//   # if found.is_none: return
//   let file_path = files.impl.path & fs_path(user_id, project_id, path)
//   fs.read(file_path)


// # has_file -----------------------------------------------------------------------------------------
// proc has_file*(files: Files, user_id, project_id, path: string): bool =
//   files.log
//     .with((user_id: user_id, project_id: project_id, path: path))
//     .info("has_file {user_id}.{project_id} {path}")
//   let file_path = files.impl.path & fs_path(user_id, project_id, path)
//   fs.exist(file_path)
//   # (user_id: user_id, project_id: project_id, path: path) in files.impl.db_files


// # files --------------------------------------------------------------------------------------------
// proc get_files*(files: Files, user_id: string, project_id: string): seq[File] =
//   files.log
//     .with((user_id: user_id, project_id: project_id))
//     .info("get_files {user_id}.{project_id}")
//   files.impl.db_files.filter (user_id: user_id, project_id: project_id)


// # save_file ----------------------------------------------------------------------------------------
// proc sha256(data: string): string

// proc set_file*(files: Files, user_id, project_id, path, hash, data: string): void =
//   files.log
//     .with((user_id: user_id, project_id: project_id, path: path, hash: hash))
//     .info("save_file {user_id}.{project_id} {path}")
//   let vhash = data.sha256
//   if hash != vhash: throw fmt"hash is wrong, should be '{vhash}'"

//   let file_path = files.impl.path & fs_path(user_id, project_id, path)
//   fs.write(file_path, data)

//   files.impl.db_files.save File(
//     user_id:    user_id,
//     project_id: project_id,
//     path:       path,
//     hash:       hash,
//     size_b:     data.len
//   )


// # del_file -----------------------------------------------------------------------------------------
// proc del_file*(files: Files, user_id: string, project_id: string, path: string): void =
//   files.log
//     .with((user_id: user_id, project_id: project_id, path: path))
//     .info("del_file {user_id}.{project_id} {path}")

//   # let impl = files.impl
//   # let found = files.get_file(user_id, project_id, path, log = false)
//   # if found.is_some:
//   #   var event = FileDeleteEvent(hash: found.get.hash)
//   #   impl.db_file_delete_events.create event
//   #   impl.db_files.del((user_id: user_id, project_id: project_id, path: path))

//   files.impl.db_files.del((user_id: user_id, project_id: project_id, path: path))
//   let file_path = files.impl.path & fs_path(user_id, project_id, path)
//   fs.delete(file_path, delete_empty_parents = true)


// # gc -----------------------------------------------------------------------------------------------
// # proc gc_step(files: Files): bool =
// #   let impl = files.impl
// #   let check_hashes = impl.db_file_delete_events.filter(sql"", limit = 100).map((e) => e.hash)
// #   if check_hashes.is_empty: return true
// #   let query = sql"""
// #     select distinct hash as hash
// #     from   files
// #     where  hash in {check_hashes}
// #   """
// #   let still_existing = impl.db.get(query, tuple[hash: string]).map((r) => r.hash).to_set
// #   let deleted_hashes = check_hashes.filter((h) => h notin still_existing)
// #   for hash in deleted_hashes: fs_delete_file(impl.path, hash)
// #   impl.db.exec sql"delete from file_delete_events where hash in {check_hashes}"
// #   false

// # proc gc*(files: Files): void =
// #   files.log.info("gc")
// #   while files.gc_step:
// #     discard


// # Helpers ------------------------------------------------------------------------------------------
// proc sha256(data: string): string =
//   var sha = nimsha2.initSHA[nimsha2.SHA256]()
//   nimsha2.update(sha, data)
//   nimsha2.toHex nimsha2.final(sha)


// # Test ---------------------------------------------------------------------------------------------
// if is_main_module:
//   let db = Db.init
//   db.impl("nim_test")
//   db.before(sql"drop table if exists files", prepend = true)

//   let files = Files.init
//   files.impl(path = "./tmp/files_test")

//   files.set_file("alex", "plot", "/index.html", "some html".sha256, "some html")
//   files.set_file("alex", "plot", "/scripts/script.js", "some js".sha256, "some js")

//   assert files.get_file("alex", "plot", "/index.html") == "some html"
//   assert files.get_file("alex", "plot", "/scripts/script.js")  == "some js"

//   files.del_file("alex", "plot", "/scripts/script.js")
//   assert (
//     try: files.get_file("alex", "plot", "/scripts/script.js") except: "not found"
//   ) == "not found"

//   assert files.get_files("alex", "plot").map((f) => f.path) == @["/index.html"]