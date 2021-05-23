// deno run --import-map=import_map.json ./play.ts
import { p } from "base/base.ts"
import { toYyyyMmDdHhMmSs } from "base/time.ts"
import { DateTimeFormatter } from "https://deno.land/std@0.97.0/datetime/formatter.ts"

let formatter = new DateTimeFormatter("yyyy-MM-dd HH:mm:ss")
p(formatter.format(new Date(), { timeZone: "UTC" }))
p(toYyyyMmDdHhMmSs(Date.now()))