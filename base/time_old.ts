import './base.ts'


export function parse_yyyy_mm_dd(yyyyMmDd: string): [number, number, number] {
  assertYyyyMmDd(yyyyMmDd)
  const parts = yyyyMmDd.split('-').map((v: string) => parseInt(v))
  return parts as any
}

function to_yyyy_mm_dd(timestamp: number): string
function to_yyyy_mm_dd(y: number, m: number, d: number): string
function to_yyyy_mm_dd(y: number, m?: number, d?: number): string {
  if        (m === undefined && d === undefined) {
    const timestamp = y
    if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
    const date = new Date(timestamp)
    return to_yyyy_mm_dd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  } else if (m !== undefined && d !== undefined) {
    if (m < 0 || m > 12) throw new Error(`invalid month ${m}`)
    if (d < 0 || d > 31) throw new Error(`invalid day ${d}`)
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`
  } else {
    throw new Error(`invalid usage of toYyyyMmDd`)
  }
}
export { to_yyyy_mm_dd }


export function to_yyyy_mm_dd_hh_mm_ss(time: number | Date): string {
  const timestamp = time instanceof Date ? time.valueOf() : time
  if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
  const date = new Date(timestamp)
  let year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate()
  let hour = date.getUTCHours(), min = date.getUTCMinutes(), sec = date.getUTCSeconds()
  return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}` +
    ` ${hour < 10 ? '0' + hour : hour}:${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`
}
export { to_yyyy_mm_dd_hh_mm_ss as formatTime }


export function yyyyMmToYm(yyyyMm: string): [number, number] {
  assert_yyyy_mm(yyyyMm)
  const parts = yyyyMm.split('-').map((v: string) => parseInt(v))
  return parts as any
}


export function yyyyMmDdToYmd(yyyyMmDd: string): [number, number, number] {
  assertYyyyMmDd(yyyyMmDd)
  const parts = yyyyMmDd.split('-').map((v: string) => parseInt(v))
  return parts as any
}


export function yyyyMmToM(yyyyMm: string, baseYear: number): number {
  const [y, m] = yyyyMmToYm(yyyyMm)
  if (y < baseYear) throw new Error(`year should be >= ${baseYear}`)
  return 12 * (y - baseYear) + m
}


export function mToYyyyMm(m: number, baseYear: number): string {
  return to_yyyy_mm(baseYear + Math.floor(m / 12), 1 + (m % 12))
}


export function yyyyMmToMs(yyyyMm: string): number {
  const [y, m] = yyyyMmToYm(yyyyMm)
  return Date.UTC(y, m - 1)
}


export function yyyyMmDdToMs(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDdToYmd(yyyyMmDd)
  return Date.UTC(y, m - 1, d)
}


export function assert_yyyy_mm(yyyyMm: string) {
  if (!/\d\d\d\d-\d\d/.test(yyyyMm)) throw new Error(`date format is not yyyy-mm '${yyyyMm}'`)
}


export function assertYyyyMmDd(yyyyMmDd: string) {
  if (!/\d\d\d\d-\d\d-\d\d/.test(yyyyMmDd)) throw new Error(`date format is not yyyy-mm-dd '${yyyyMmDd}'`)
}


function to_yyyy_mm(timestamp: number): string
function to_yyyy_mm(y: number, m: number): string
function to_yyyy_mm(y: number, m?: number): string {
  if (m === undefined) {
    const timestamp = y
    if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
    const date = new Date(timestamp)
    return to_yyyy_mm(date.getUTCFullYear(), date.getUTCMonth() + 1)
  } else {
    if (m < 0 || m > 12) throw new Error(`invalid month ${m}`)
    return `${y}-${m < 10 ? '0' + m : m}`
  }
}
export { to_yyyy_mm }


export function currentYyyyMm(): string {
  const now = new Date(Date.now())
  return to_yyyy_mm(now.getUTCFullYear(), now.getUTCMonth() + 1)
}


export function currentYyyyMmDd(): string {
  const now = new Date(Date.now())
  return to_yyyy_mm_dd(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}