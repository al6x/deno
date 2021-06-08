import { some, take } from './base.ts'


export function parseYyyyMmDd(yyyyMmDd: string): [number, number, number] {
  assertYyyyMmDd(yyyyMmDd)
  const parts = yyyyMmDd.split('-').map((v: string) => parseInt(v))
  return parts as some
}

function toYyyyMmDd(timestamp: number): string
function toYyyyMmDd(y: number, m: number, d: number): string
function toYyyyMmDd(y: number, m?: number, d?: number): string {
  if        (m === undefined && d === undefined) {
    const timestamp = y
    if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
    const date = new Date(timestamp)
    return toYyyyMmDd(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())
  } else if (m !== undefined && d !== undefined) {
    if (m < 0 || m > 12) throw new Error(`invalid month ${m}`)
    if (d < 0 || d > 31) throw new Error(`invalid day ${d}`)
    return `${y}-${m < 10 ? '0' + m : m}-${d < 10 ? '0' + d : d}`
  } else {
    throw new Error(`invalid usage of toYyyyMmDd`)
  }
}
export { toYyyyMmDd }


export function toYyyyMmDdHhMmSs(time: number | Date): string {
  const timestamp = time instanceof Date ? time.valueOf() : time
  if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
  const date = new Date(timestamp)
  let year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate()
  let hour = date.getUTCHours(), min = date.getUTCMinutes(), sec = date.getUTCSeconds()
  return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}` +
    ` ${hour < 10 ? '0' + hour : hour}:${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`
}
export { toYyyyMmDdHhMmSs as formatTime }


export function yyyyMmToYm(yyyyMm: string): [number, number] {
  assertYyyyMm(yyyyMm)
  const parts = yyyyMm.split('-').map((v: string) => parseInt(v))
  return parts as some
}


export function yyyyMmDdToYmd(yyyyMmDd: string): [number, number, number] {
  assertYyyyMmDd(yyyyMmDd)
  const parts = yyyyMmDd.split('-').map((v: string) => parseInt(v))
  return parts as some
}


export function yyyyMmToM(yyyyMm: string, baseYear: number): number {
  const [y, m] = yyyyMmToYm(yyyyMm)
  if (y < baseYear) throw new Error(`year should be >= ${baseYear}`)
  return 12 * (y - baseYear) + m
}


export function mToYyyyMm(m: number, baseYear: number): string {
  return toYyyyMm(baseYear + Math.floor(m / 12), 1 + (m % 12))
}


export function yyyyMmToMs(yyyyMm: string): number {
  const [y, m] = yyyyMmToYm(yyyyMm)
  return Date.UTC(y, m - 1)
}


export function yyyyMmDdToMs(yyyyMmDd: string): number {
  const [y, m, d] = yyyyMmDdToYmd(yyyyMmDd)
  return Date.UTC(y, m - 1, d)
}


export function assertYyyyMm(yyyyMm: string) {
  if (!/\d\d\d\d-\d\d/.test(yyyyMm)) throw new Error(`date format is not yyyy-mm '${yyyyMm}'`)
}


export function assertYyyyMmDd(yyyyMmDd: string) {
  if (!/\d\d\d\d-\d\d-\d\d/.test(yyyyMmDd)) throw new Error(`date format is not yyyy-mm-dd '${yyyyMmDd}'`)
}


function toYyyyMm(timestamp: number): string
function toYyyyMm(y: number, m: number): string
function toYyyyMm(y: number, m?: number): string {
  if (m === undefined) {
    const timestamp = y
    if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
    const date = new Date(timestamp)
    return toYyyyMm(date.getUTCFullYear(), date.getUTCMonth() + 1)
  } else {
    if (m < 0 || m > 12) throw new Error(`invalid month ${m}`)
    return `${y}-${m < 10 ? '0' + m : m}`
  }
}
export { toYyyyMm }


export function currentYyyyMm(): string {
  const now = new Date(Date.now())
  return toYyyyMm(now.getUTCFullYear(), now.getUTCMonth() + 1)
}


export function currentYyyyMmDd(): string {
  const now = new Date(Date.now())
  return toYyyyMmDd(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}

// parseMonth ---------------------------------------------------------------------------
const monthNames = [
  'january',
  'february',

  'march',
  'april',
  'may',

  'june',
  'july',
  'august',

  'september',
  'october',
  'november',

  'december'
]
const shortMonthNames = monthNames.map((name) => take(name, 3))

const monthNamesMap = new Map<string, number>()
const shortMonthNamesMap = new Map<string, number>()
for (let i = 0; i < monthNames.length; i++) {
  monthNamesMap.set(monthNames[i], i + 1)
  shortMonthNamesMap.set(shortMonthNames[i], i + 1)
}

export function parse_month(month: string): number {
  const month_l = month.toLowerCase()
  const n = monthNamesMap.get(month_l) || shortMonthNamesMap.get(month_l)
  if (n === undefined) throw new Error(`invalid month name '${month}'`)
  return n
}