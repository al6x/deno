import { something, take, entries } from './base.ts'


export function parse_yyyy_mm_dd(yyyy_mm_dd: string): [number, number, number] {
  assert_yyyy_mm_dd(yyyy_mm_dd)
  const parts = yyyy_mm_dd.split('-').map((v: string) => parseInt(v))
  return parts as something
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
    throw new Error(`invalid usage of to_yyyy_mm_dd`)
  }
}
export { to_yyyy_mm_dd }


export function to_yyyy_mm_dd_hh_mm_ss(timestamp: number): string {
  if (timestamp < 10000) throw new Error(`value for timestamp is too low, probably an error`)
  const date = new Date(timestamp)
  let year = date.getUTCFullYear(), month = date.getUTCMonth() + 1, day = date.getUTCDate()
  let hour = date.getUTCHours(), min = date.getUTCMinutes(), sec = date.getUTCSeconds()
  return `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}` +
    ` ${hour < 10 ? '0' + hour : hour}:${min < 10 ? '0' + min : min}:${sec < 10 ? '0' + sec : sec}`
}


export function yyyy_mm_to_y_m(yyyy_mm: string): [number, number] {
  assert_yyyy_mm(yyyy_mm)
  const parts = yyyy_mm.split('-').map((v: string) => parseInt(v))
  return parts as something
}


export function yyyy_mm_dd_to_y_m_d(yyyy_mm_dd: string): [number, number, number] {
  assert_yyyy_mm_dd(yyyy_mm_dd)
  const parts = yyyy_mm_dd.split('-').map((v: string) => parseInt(v))
  return parts as something
}


export function yyyy_mm_to_m(yyyy_mm: string, base_year: number): number {
  const [y, m] = yyyy_mm_to_y_m(yyyy_mm)
  if (y < base_year) throw new Error(`year should be >= ${base_year}`)
  return 12 * (y - base_year) + m
}


export function m_to_yyyy_mm(m: number, base_year: number): string {
  return to_yyyy_mm(base_year + Math.floor(m / 12), 1 + (m % 12))
}


export function yyyy_mm_to_ms(yyyy_mm: string): number {
  const [y, m] = yyyy_mm_to_y_m(yyyy_mm)
  return Date.UTC(y, m - 1)
}


export function yyyy_mm_dd_to_ms(yyyy_mm_dd: string): number {
  const [y, m, d] = yyyy_mm_dd_to_y_m_d(yyyy_mm_dd)
  return Date.UTC(y, m - 1, d)
}


export function assert_yyyy_mm(yyyy_mm: string) {
  if (!/\d\d\d\d-\d\d/.test(yyyy_mm)) throw new Error(`date format is not yyyy-mm '${yyyy_mm}'`)
}


export function assert_yyyy_mm_dd(yyyy_mm_dd: string) {
  if (!/\d\d\d\d-\d\d-\d\d/.test(yyyy_mm_dd)) throw new Error(`date format is not yyyy-mm-dd '${yyyy_mm_dd}'`)
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


export function current_yyyy_mm(): string {
  const now = new Date(Date.now())
  return to_yyyy_mm(now.getUTCFullYear(), now.getUTCMonth() + 1)
}


export function current_yyyy_mm_dd(): string {
  const now = new Date(Date.now())
  return to_yyyy_mm_dd(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate())
}

// parse_month ---------------------------------------------------------------------------
const month_names = [
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
const short_month_names = month_names.map((name) => take(name, 3))

const month_names_map = new Map<string, number>()
const short_month_names_map = new Map<string, number>()
for (let i = 0; i < month_names.length; i++) {
  month_names_map.set(month_names[i], i + 1)
  short_month_names_map.set(short_month_names[i], i + 1)
}

export function parse_month(month: string): number {
  const month_l = month.toLowerCase()
  const n = month_names_map.get(month_l) || short_month_names_map.get(month_l)
  if (n === undefined) throw new Error(`invalid month name '${month}'`)
  return n
}