// deno run --import-map=import_map.json ./play.ts
import { p, buildUrl } from "base/base.ts"

p(new URL("/").hostname)

// p(buildUrl("http://ya.ru/login", { back: "назад" }))
// p(new URL(buildUrl("http://ya.ru/login", { back: "назад" })).searchParams.get("back"))