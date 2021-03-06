import { get_env } from "./env.ts"

export * from './map.ts'

// Safe any ----------------------------------------------------------------------------------------
export type something = any
export type some = any
let deno = 'Deno' in window ? (window as some).Deno : undefined

// Global variables for browser and node -----------------------------------------------------------
// export const global: some = window

// Useful constants --------------------------------------------------------------------------------
export const kb = 1024, mb = 1024 * kb
export const sec = 1000, min = 60 * sec, hour = 60 * min, day = 24 * hour
export const million = 1000000, billion = 1000 * million


// isBrowser --------------------------------------------------------------------------------------
export function isBrowser() { return deno == undefined }

// p -----------------------------------------------------------------------------------------------
function mapToJsonIfDefined(v: some) { return v && v.toJSON ? v.toJSON() : v }
export function prettyPrint(v: some, colors = false) {
  v = deepMap(v, mapToJsonIfDefined)
  return deno && typeof v == 'object' ? deno.inspect(v, { colors }) : v
}
export function p(...args: some): void {
  if (isBrowser()) console.log(...args)
  else {
    const formatted = args.map((v: some) => prettyPrint(v, true))
    // It won't printed properly for multiple arguments
    args.length == 1 ? console.log(...formatted) : console.log(...formatted)
  }
}

// Test ---------------------------------------------------------------------
const tests: { name: string, test: (() => void) | (() => Promise<void>) }[] = []
let lastRunnedTest = 0, testingInProgress = false
export function runTests () {
  if (testingInProgress) return
  testingInProgress = true
  setTimeout(async () => {
    while (lastRunnedTest < tests.length) {
      let { name, test } = tests[lastRunnedTest]
      lastRunnedTest += 1
      try {
        console.log(`  test | ${name}`)
        let promise = test()
        if (promise) await promise
      } catch (e) {
        console.error(`  test | ${name} failed`)
        console.error(e)
        if (!isBrowser()) throw e
      }
    }
    // console.log(`  test | success`)
    testingInProgress = false
  }, 0)
}
(window as some).runTests = runTests

let testEnabledS: string
try   { testEnabledS = (get_env("test") || "").toLowerCase() }
catch { testEnabledS = "false" }
let slowTestEnabled = testEnabledS == "all"
let testEnabled = slowTestEnabled || (testEnabledS == "true")

export function test(name: string | { name: string }, test: (() => void) | (() => Promise<void>)) {
  name = typeof name == 'string' ? name : name.name
  tests.push({ name, test })
  if (testEnabled || name.toLowerCase() == testEnabledS) runTests()
}

export function slowTest(name: string | { name: string }, test: (() => void) | (() => Promise<void>)) {
  name = typeof name == 'string' ? name : name.name
  tests.push({ name, test })
  if (slowTestEnabled || name.toLowerCase() == testEnabledS) runTests()
}


// export interface TestApi {
//   (fn: () => void): void
//   (name: string, fn: (() => void)): void
//   focus: {
//     (fn: () => void): void
//     (name: string, fn: (() => void)): void
//   }
//   run(): void
// }
// const focusedTests: [string | undefined, () => void][] = []
// const tests: [string | undefined, () => void][] = []
// export const test = <TestApi>function(...args: some[]) {
//   const [name, fn] = args.length == 1 ? [undefined, args[0]] : args
//   tests.push([name, fn])
// }
// test.focus = function(...args: some[]) {
//   const [name, fn] = args.length == 1 ? [undefined, args[0]] : args
//   focusedTests.push([name, fn])
// }
// test.run = async () => {
//   const list = focusedTests.length > 0 ? focusedTests : tests
//   for(const [name, test] of list) {
//     try {
//       await test()
//     } catch(e) {
//       console.error(`test failed ${name ? ` '${name}'` : ''}`, e)
//       if (deno) deno.exit()
//     }
//   }
//   // log('info', 'tests passed')
// }


// documentation -------------------------------------------------------------------------
export interface TextDoc {
  readonly tags?:  string[]
  readonly title:  string
  readonly text:   string
}
export interface TodoDoc {
  readonly priority?: 'low' | 'normal' | 'high'
  readonly tags?:     string[]
  readonly todo:      string
}
export type Doc = TextDoc | TodoDoc
export const allDocs: Doc[] = []
export function doc(...docs: (Doc | (() => Doc))[]) {
  allDocs.push(...(docs.map((d) => typeof d === 'function' ? d() : d)))
}
export function asCode(code: string) { return "\`\`\`\n" + code + "\n\`\`\`" }


// httpCall ----------------------------------------------------------------------
export type HttpMethod = 'get' | 'post' | 'put' | 'delete'
export interface HttpCallOptions {
  method?:  HttpMethod
  headers?: { [key: string]: string }
  params?:  { [key: string]: string | undefined }
  timeout?: number
}
export async function httpCall<In, Out>(
  url: string, body: In | {} = {}, options: HttpCallOptions = {}
): Promise<Out> {
  async function callWithoutTimeout() {
    try {
      // const copied_options1 = { ...{ method: 'post' }, ...options }
      // delete copied_options.timeout
      const urlWithParams = options.params ? build_url(url, options.params) : url
      const method = (options.method ?  options.method  : 'post').toUpperCase()
      const response = await fetch(
        urlWithParams,
        {
          method,
          headers: options.headers ? options.headers : { 'Content-Type': 'application/json' },
          body:    method != 'get' ? JSON.stringify(body) : undefined
        }
      )
      if (!response.ok)
        throw new Error(`can't ${method} ${url} ${response.status} ${response.statusText}`)
      let data = await response.json()
      if (data.is_error) throw new Error(data.message || "Unknown error")
      return data
    } catch (e) {
      throw e
    }
  }
  return new Promise((resolve, reject) => {
    if (options.timeout)
    setTimeout(() => reject(new Error(`request timed out ${url}`)), options.timeout)
    callWithoutTimeout().then(resolve, reject)
  })
}


// httpPost ----------------------------------------------------------------------
export interface HttpRawOptions {
  headers?:    { [key: string]: string }
  timeout_ms?: number
}

export function httpGet(url: string, options?: HttpRawOptions): Promise<string> {
  return httpCallRaw("get", url, "", options)
}

export function httpPost(url: string, content = "", options?: HttpRawOptions): Promise<string> {
  return httpCallRaw("post", url, content, options)
}

async function httpCallRaw(method: string, url: string, content = "", options?: HttpRawOptions): Promise<string> {
  async function callWithoutTimeout() {
    try {
      const response = await fetch(url, {
        method: method.toUpperCase(),
        ...(options?.headers ? { headers: options?.headers } : {}),
        ...(content != "" ? { body: content } : {})
      })
      if (!response.ok) throw new Error(`can't  post ${url} ${response.status} ${response.statusText}`)
      return await response.text()
    } catch (e) {
      throw e
    }
  }
  return new Promise((resolve, reject) => {
    if (options?.timeout_ms) setTimeout(() => reject(new Error(`request timed out ${url}`)), options.timeout_ms)
    callWithoutTimeout().then(resolve, reject)
  })
}


// build_url ----------------------------------------------------------------------
export function build_url(
  url: string, query: { [key: string]: string | number | undefined | boolean | null } = {}
): string {
  const querystring: string[] = []
  for (const key in query) {
    const value = query[key]
    if (key !== null && key !== undefined && value !== null && value !== undefined)
      querystring.push(`${encodeURIComponent(key)}=${encodeURIComponent('' + query[key])}`)
  }
  if (querystring.length > 0) return `${url}${url.includes('?') ? '&' : '?'}${querystring.join('&')}`
  else                        return url
}

// sleep --------------------------------------------------------------------------
export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}


// isNumber -----------------------------------------------------------------------------
export function isNumber(n: number | undefined | null): n is number {
  // isNumber is broken, it returns true for NaN
  return typeof n == 'number' ? Number.isFinite(n) : false
}

// assert -------------------------------------------------------------------------
export interface Assert {
  (condition: boolean, message?: string | (() => string)): void
  warn(condition: boolean, message?: string): void
  equal<T>(a: T, b: T, message?: string | (() => string)): void
  fail(cb: () => void, message?: string | (() => string)): void
  approxEqual(a: number, b: number, message?: string | (() => string), deltaRelative?: number): void
}
export const assert = <Assert>function(condition, message): void {
  const messageString = message ? (message instanceof Function ? message() : message) : 'Assertion error!'
  if (!condition) throw new Error(messageString)
}
// assert.warn = (condition, message) => { if (!condition) log('warn', message || 'Assertion error!') }
assert.equal = (a, b, message) => {
  if (!isEqual(a, b)) {
    const messageString = message ?
      (message instanceof Function ? message() : message) :
      `Assertion error: ${toJson(a, true)} != ${toJson(b, true)}`
    throw new Error(messageString)
  }
}
assert.fail = (cb, message) => {
  let failed = false
  try { cb() } catch { failed = true }
  if (!failed) {
    const messageString = message ?
      (message instanceof Function ? message() : message) :
      `Assertion error: expected to fail but didn't`
    throw new Error(messageString)
  }
}
assert.approxEqual = (a, b, message, deltaRelative) => {
  deltaRelative = deltaRelative || 0.001
  const average = (Math.abs(a) + Math.abs(b)) / 2
  const deltaAbsolute = average * deltaRelative
  if (Math.abs(a - b) > deltaAbsolute) {
    const messageString = message ? (message instanceof Function ? message() : message) :
      `Assertion error: ${toJson(a, true)} != ${toJson(b, true)}`
    throw new Error(messageString)
  }
}

// deepCloneAndSort ------------------------------------------------------------
// Clone object with object properties sorted, including for nested objects
export function deepCloneAndSort(obj: some): some {
  if      (obj === null || typeof obj !== 'object') return obj
  else if (Array.isArray(obj))                      return obj.map(deepCloneAndSort)
  else if ('toJSON' in obj)                         return deepCloneAndSort(obj.toJSON())
  else                                              return Object.assign({},
      ...Object.entries(obj)
        .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
        .map(([k, v]) => ({ [k]: deepCloneAndSort(v) })
    ))
}

// toJson ----------------------------------------------------------
// https://stackoverflow.com/questions/42491226/is-json-stringify-deterministic-in-v8
// Stable JSON
export function toJson(obj: unknown, pretty = true): string {
  return pretty ? JSON.stringify(deepCloneAndSort(obj), null, 2) : JSON.stringify(deepCloneAndSort(obj))
}

// isEqual -----------------------------------------------------------------------
export function isEqual(a: unknown, b: unknown): boolean {
  return toJson(a) === toJson(b)
}

// deepMap -----------------------------------------------------------------------
export function deepMap(obj: some, map: (o: some) => some): some {
  obj = map(obj)
  if      (obj === null || typeof obj !== 'object') return obj
  else if ('map' in obj)                            return obj.map((v: some) => deepMap(v, map))
  else                                              return Object.assign({},
      ...Object.entries(obj)
        .map(([k, v]) => ({ [k]: deepMap(v, map) })
    ))
}
test("deepMap", () => {
  class Wrapper<T> {
    constructor(readonly v: T) {}
    toJSON() { return this.v }
  }
  const a = new Wrapper([1, 2])
  assert.equal(deepMap(a, mapToJsonIfDefined), [1, 2])

  const aL2 = new Wrapper([a, 3])
  assert.equal(deepMap(aL2, mapToJsonIfDefined), [[1, 2], 3])
})


// export function logWithUser(
//   level: LogLevel, user: string, message: string, short?: some, detailed?: some
// ): string { return log(level, `${pad(user, 8)} ${message}`, short, detailed) }


// Timer -------------------------------------------------------------------------------------------
export function timerMs(): () => number {
  const start = Date.now()
  return function(){ return Date.now() - start }
}

export function timerSec(): () => number {
  const start = Date.now()
  return function(){ return Math.round((Date.now() - start) / 1000) }
}

// cleanStack -------------------------------------------------------------------------------------
export let cleanStack: (stack: string) => string
{
  // const stack_skip_re = new RegExp([
  //   '/node_modules/',
  //   'internal/(modules|bootstrap|process)',
  //   'at new Promise \\(<anonymous>\\)',
  //   'at Object.next \\(',
  //   'at step \\(',
  //   'at __awaiter \\(',
  //   'at Object.exports.assert \\('
  // ].join('|'))
  cleanStack = (stack) => {
    // const lines = stack
    //   .split("\n")
    //   .filter((line) => {
    //     return !stack_skip_re.test(line)
    //   })
    //   .map((line, i) =>
    //     i == 0 ? line : line.replace(/([^\/]*).*(\/[^\/]+\/[^\/]+\/[^\/]+)/, (_match, s1, s2) => s1 + '...' + s2)
    //   )
    // return lines.join("\n")
    return stack
  }
}

// uniglobal.process && uniglobal.process.on('uncaughtException', function(error: some) {
//   error.stack = cleanStack(error.stack)
//   console.log('')
//   console.error(error)
//   process.exit()
// })


// Promise ------------------------------------------------------------------------
export function once<F extends Function>(f: F): F {
  let called = false, result: some = undefined
  return function (this: some) {
    if (called) return result
    result = f.apply(this, arguments)
    called = true
    return result
  } as some
}


// Promise ------------------------------------------------------------------------
// For better logging, by default promise would be logged as `{}`
;(Promise.prototype as some).toJSON = function() { return 'Promise' }
Object.defineProperty(Promise.prototype, "cmap", { configurable: false, enumerable: false })




// parse -------------------------------------------------------------------------------------------
export function parse(r: RegExp, s: string): string[] {
  const found = s.match(r)
  if (!found) return []
  if (found.length == 1) return [] // matched but there's no capture groups
  return found.slice(1, found.length)
}

test("parse", () => {
  assert.equal(parse(/.+ (\d+) (\d+)/, "a 22 45"), ["22", "45"])
  assert.equal(parse(/[^;]+;/, "drop table; create table;"), [])
})


// parse_named -------------------------------------------------------------------------------------
export function parseNamed(r: RegExp, s: string): Record<string, string> {
  const found = s.match(r)
  return found?.groups || {}
}

test("parseNamed", () => {
  assert.equal(parseNamed(/.+ (?<a>\d+) (?<b>\d+)/, "a 22 45"), { "a": "22", "b": "45" })
})


// parse1,2,3,4 ------------------------------------------------------------------------------------
export function parse1(r: RegExp, s: string): string {
  const found = parse(r, s)
  if (found.length != 1) throw new Error(`expected 1 match but found ${found.length}`)
  return found[0]
}

export function parse2(r: RegExp, s: string): [string, string] {
  const found = parse(r, s)
  if (found.length != 2) throw new Error(`expected 2 matches but found ${found.length}`)
  return [found[0], found[1]]
}

export function parse3(r: RegExp, s: string): [string, string, string] {
  const found = parse(r, s)
  if (found.length != 3) throw new Error(`expected 3 matches but found ${found.length}`)
  return [found[0], found[1], found[2]]
}














// --------------------------------------------------------------------------------
// Extensions ---------------------------------------------------------------------
// --------------------------------------------------------------------------------


type Predicate<V, K> = (value: V, key: K) => boolean

// type OMap<T> = { [key: string]: T }


// length -------------------------------------------------------------------------
export function length<T>(o: Array<T> | { [key: string]: T } | String | string): number {
  if (o instanceof Array)                               return o.length
  else if (o instanceof String || typeof o == 'string') return o.length
  else {
    let i = 0
    for (const k in o) if (o.hasOwnProperty(k)) i++
    return i
  }
}


// is_empty -----------------------------------------------------------------------
export function is_empty<T>(o: Array<T> | { [key: string]: T } | String | string): boolean {
  return length(o) == 0
}


// trim --------------------------------------------------------------------------------------------
export function trim(text: string): string { return text.replace(/^[\t\s\n]+|[\t\s\n]+$/g, '') }


// dedent ------------------------------------------------------------------------------------------
export function dedent(text: string): string {
  text = text.replace(/^\s*\n|[\n\s]+$/, "") // Replacing the first and last empty line
  const match = parse(/^(\s+)/, text)
  if (match.length == 0) return text
  return text.split("\n").map((s) => s.startsWith(match[0]) ? s.replace(match[0], '') : s).join("\n")
  // return text.replace(new RegExp("^\\s{" + match[0].length + "}", "gm"), "")
}
test("dedent", () => {
  assert.equal(dedent("\n  a\n  b\n    c"), "a\nb\n  c")
})


// take ---------------------------------------------------------------------------
function take<T>(s: string, n: number): string
function take<T>(list: Array<T>, n: number): Array<T>
function take<T>(list: string | Array<T>, n: number) {
  return list.slice(0, n)
}
export { take }


// last ---------------------------------------------------------------------------
export function last<T>(list: Array<T>): T
export function last<T>(list: Array<T>, n: number): T[]
export function last<T>(list: string): T[]
export function last<T>(list: string, n: number): T[]
export function last<T>(list: Array<T> | string, n?: number) {
  if (n === undefined) {
    if (list.length < 1) throw new Error(`can't get last elements from empty list`)
    return list[list.length - 1]
  } else {
    if (list.length < n) throw new Error(`can't get last ${n} elements from list of length ${list.length}`)
    else return list.slice(list.length - n, list.length)
  }
}


// last ---------------------------------------------------------------------------
export function first<T>(list: Array<T>): T
export function first<T>(list: Array<T>, n: number): T[]
export function first<T>(list: Array<T>, n?: number) {
  if (n === undefined) {
    if (list.length < 1) throw new Error(`can't get first elements from empty list`)
    return list[0]
  } else {
    if (list.length < n) throw new Error(`can't get first ${n} elements from list of length ${list.length}`)
    else return list.slice(0, n)
  }
}


// reverse -------------------------------------------------------------------------------
export function reverse<T>(list: T[]): T[] {
  list = [...list]
  list.reverse()
  return list
}


// each ----------------------------------------------------------------------------------
function each<T>(list: T[], f: (v: T, i: number) => void): void
function each<K, V>(map: Map<K, V>, f: (v: V, k: K) => void): void
function each<M extends {}, K extends keyof M>(map: M, f: (v: M[K], k: K) => void): void
function each<T>(o: T[] | { [key: string]: T }, f: (v: T, i: some) => void): void {
  if      (o instanceof Array) for(let i = 0; i < o.length; i++) f(o[i], i)
  else if (o instanceof Map)   for(const [k, v] of o) f(v, k)
  else                         for(const k in o) if (o.hasOwnProperty(k)) f(o[k], k)
}
export { each }


// Found ---------------------------------------------------------------------------------
export type Found<V> = { found: true, value: V } | { found: false, message: string }


// find ----------------------------------------------------------------------------------
function find<T>(list: T[], v: T): T | undefined
function find<T>(list: T[], f: (v: T, i: number) => boolean): T | undefined
function find<T>(map: { [key: string]: T }, f: (v: T, k: string) => boolean): T | undefined
function find<T>(o: T[] | { [key: string]: T }, finder: T | ((v: T, i: some) => boolean)): T | undefined {
  const predicate = finder instanceof Function ? finder : (v: T) => v == finder
  if (o instanceof Array) for(let i = 0; i < o.length; i++) if (predicate(o[i], i)) return o[i]
  else                    for(const k in o) if (o.hasOwnProperty(k)) if (predicate(o[k], k)) return o[k]
  return undefined
}
export { find }


// ensureFind ---------------------------------------------------------------------------
function ensureFind<T>(list: T[], v: T, onError?: string | (() => string)): T
function ensureFind<T>(list: T[], f: (v: T, i: number) => boolean, onError?: string | (() => string)): T
function ensureFind<T>(
  map: { [key: string]: T }, f: (v: T, k: string) => boolean, onError?: string | (() => string)
): T
function ensureFind<T>(
  o: some, finder: T | ((v: T, i: some) => boolean), onError?: string | (() => string)
): T {
  const found = find(o, finder) as T
  if (found === undefined)
    throw new Error(onError ? (typeof onError == 'function' ? onError() : onError) : `element not found!`)
  return found
}
export { ensureFind }


// findi ----------------------------------------------------------------------------
function findi<T>(list: T[], v: T): number
function findi<T>(list: T[], f: (v: T, i: number) => boolean): number
function findi<T>(list: T[], finder: T | ((v: T, i: some) => boolean)): number {
  const predicate = finder instanceof Function ? finder : (v: T) => v == finder
  for(let i = 0; i < list.length; i++) if (predicate(list[i], i)) return i
  return -1
}
export { findi }


// findi_min/max -----------------------------------------------------------------------------------
function findiMin(list: number[]): number
function findiMin<T>(list: T[], op: ((v: T) => number)): number
function findiMin<T>(list: T[], op?: ((v: T) => number)): number {
  op = op || ((v: some) => v)
  if (list.length == 0) return -1
  let min = op(list[0]), minI = 0
  for(let i = 1; i < list.length; i++) {
    let m = op(list[i])
    if (m < min) {
      min = m
      minI = i
    }
  }
  return minI
}
export { findiMin }

function findiMax(list: number[]): number
function findiMax<T>(list: T[], op: ((v: T) => number)): number
function findiMax<T>(list: T[], op?: ((v: T) => number)): number {
  op = op || ((v: some) => v)
  if (list.length == 0) return -1
  let min = op(list[0]), minI = 0
  for(let i = 1; i < list.length; i++) {
    let m = op(list[i])
    if (m > min) {
      min = m
      minI = i
    }
  }
  return minI
}
export { findiMax }


// median --------------------------------------------------------------------------------
export function median(values: number[], isSorted = false): number {
  return quantile(values, .5, isSorted)
  // if (values.length == 0 ) return 0
  // values = [...values]
  // values.sort(function(a, b) { return a-b })
  // const half = Math.floor(values.length / 2)
  // if (values.length % 2) return values[half]
  // else                   return (values[half - 1] + values[half]) / 2.0
}


// quantile ------------------------------------------------------------------------------
export function quantile(values: number[], q: number, isSorted = false): number {
  const sorted = isSorted ? values : [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * q
  const base = Math.floor(pos)
  const rest = pos - base
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base])
  } else {
    return sorted[base]
  }
}

// findLastIndex -----------------------------------------------------------------------
function findLastIndex<T>(list: T[], v: T): number | undefined
function findLastIndex<T>(list: T[], f: (v: T, i: number) => boolean): number | undefined
function findLastIndex<T>(list: T[], finder: T | ((v: T, i: some) => boolean)): number | undefined {
  const predicate = finder instanceof Function ? finder : (v: T) => v == finder
  for(let i = list.length - 1; i >= 0; i--) if (predicate(list[i], i)) return i
  return undefined
}

export { findLastIndex }


// groupBy ------------------------------------------------------------------------------
function groupBy<V>(list: V[], f: (v: V, i: number) => number): Map<number, V[]>
function groupBy<V>(list: V[], f: (v: V, i: number) => string): Map<string, V[]>
function groupBy<V>(list: V[], f: (v: V, i: some) => some): Map<some, V[]> {
  return reduce(list, new Map<string | number, V[]>(), (acc, v, i) => {
    const key = f(v, i)
    let group = acc.get(key)
    if (!group) {
      group = []
      acc.set(key, group)
    }
    group.push(v)
    return acc
  })
}
export { groupBy }


// groupByN --------------------------------------------------------------------------------------
export function groupByN<V>(list: V[], n: number): V[][] {
  const result: V[][] = []
  let i = 0
  while (true) {
    const group: V[] = []
    if (i < list.length) result.push(group)

    for (let j = 0; j < n; j++) {
      if ((i + j) < list.length) group.push(list[i + j])
      else return result
    }

    i+= n
  }
}
test("groupByN", () => {
  assert.equal(groupByN([1, 2, 3], 2), [[1, 2], [3]])
  assert.equal(groupByN([1, 2], 2), [[1, 2]])
  assert.equal(groupByN([1], 2), [[1]])
  assert.equal(groupByN([], 2), [])
})


// executeAsync -----------------------------------------------------------------------------------
export async function executeAsync<T, R>(
  tasks: T[], process: ((task: T) => Promise<R>), workersCount: number
): Promise<R[]> {
  const results: { [key: number]: R } = {}
  let i = 0
  async function worker() {
    while (i < tasks.length) {
      const taskI = i++
      const task = tasks[taskI]
      results[taskI] = await process(task)
    }
  }
  const promises: Promise<void>[] = []
  for (let i = 0; i < workersCount; i++) promises.push(worker())
  for (const promise of promises) await promise
  return map(tasks, (_v, i) => results[i])
}


// entries ------------------------------------------------------------------------------
function entries<K, V>(map: Map<K, V>): [K, V][]
function entries<V>(map: { [key: string]: V }): [string, V][]
function entries<K, V>(map: Map<K, V> | { [key: string]: V }): [K | string, V][] {
  return map instanceof Map ? Array.from(map) : Object.entries(map)
}
export { entries }


// has ----------------------------------------------------------------------------
function has<T>(list: T[], v: T): boolean
function has<T>(list: T[], f: (v: T, i: number) => boolean): boolean
function has<T>(map: { [key: string]: T }, f: (v: T, k: string) => boolean): boolean
function has(o: some, finder: some): boolean { return !!find(o, finder) }
export { has }


// partition ----------------------------------------------------------------------
function partition<T>(list: Array<T>, f: Predicate<T, number>): [Array<T>, Array<T>]
function partition<T>(list: Array<T>, keys: number[]): [Array<T>, Array<T>]
function partition<M extends {}, K extends keyof M>(map: M, f: Predicate<M[keyof M], keyof M>): [M, M]
function partition<M extends {}, K extends keyof M>(map: M, keys: (keyof M)[]): [Pick<M, K>, Exclude<M, K>]
function partition(o: some, splitter: some) {
  if (o instanceof Array) {
    const selected = new Array(), rejected = new Array()
    const f = splitter instanceof Function ? splitter : (_v: some, i: some) => splitter.includes(i)
    each(o, (v, i) => f(v, i) ? selected.push(v) : rejected.push(v))
    return [selected, rejected]
  } else {
    const selected = {} as some, rejected = {} as some
    const f = splitter instanceof Function ? splitter : (_v: some, k: some) => splitter.includes(k)
    each(o, (v, k) => f(v, k) ? selected[k] = v : rejected[k] = v)
    return [selected, rejected]
  }
}
export { partition }


// sort ---------------------------------------------------------------------------
function sort(list: string[], comparator?: (a: string, b: string) => number): string[]
function sort(list: number[], comparator?: (a: number, b: number) => number): number[]
function sort<V>(list: V[], comparator?: (a: V, b: V) => number): V[] {
  if (list.length == 0) return list
  else {
    if (comparator) {
      list = [...list]
      list.sort(comparator)
      return list
    } else {
      if      (typeof list[0] == 'number')
        comparator = function(a: number, b: number) { return a - b } as some
      else if (typeof list[0] == 'string')
        comparator = function(a: string, b: string) { return a.localeCompare(b) } as some
      else
        throw new Error(`the 'comparator' required to sort a list of non numbers or strings`)

      list = [...list]
      list.sort(comparator)
      return list
    }
  }
}
export { sort }


// sortBy -------------------------------------------------------------------------------
function sortBy<V>(list: V[], by: (v: V) => string, reverse?: boolean): V[]
function sortBy<V>(list: V[], by: (v: V) => number, reverse?: boolean): V[]
function sortBy<V>(list: V[], by: (v: V) => boolean, reverse?: boolean): V[]
function sortBy<V>(list: V[], by: (v: some) => some, reverse = false): V[] {
  if (list.length == 0) return list
  else {
    const type = typeof by(list[0])
    let comparator: (a: V, b: V) => number
    if      (type == 'number') {
      comparator = function(a, b) { return by(a) - by(b) }
    } else if (type == 'boolean') {
      comparator = function(a, b) { return (by(a) ? 1 : 0) - (by(b) ? 1 : 0) }
    } else if (type == 'string') {
      comparator = function(a, b) { return by(a).localeCompare(by(b)) }
    } else {
      throw new Error(`invalid return type for 'by' '${type}'`)
    }

    let sorted: V[]
    sorted = [...list]
    sorted.sort(comparator)
    if (reverse) sorted.reverse()
    return sorted
  }
}

test("sortBy", () => {
  assert.equal(sortBy([{ v: true }, { v: false }], ({v}) => v), [{ v: false }, { v: true }])

  assert.equal(
    sortBy([{ v: "b" }, { v: "" }, { v: "c" }], ({v}) => v),
    [{ v: "" }, { v: "b" }, { v: "c"}]
  )
})

export { sortBy }


// filterMap -------------------------------------------------------------------------
function filterMap<V, S>(list: V[], f: (v: V, i: number) => S | false): S[]
function filterMap<V, S>(map: Map<number, V>, f: (v: V, k: number) => S | false): Map<number, S>
function filterMap<V, S>(map: Map<string, V>, f: (v: V, k: string) => S | false): Map<string, S>
function filterMap<V, S>(map: { [key: string]: V }, f: (v: V, k: string) => S | false): { [key: string]: S }
function filterMap(o: some, f: some): some {
  if (o instanceof Array) {
    const filtered: some[] = []
    each(o, (v, k) => {
      const r = f(v, k)
      if (r !== false) filtered.push(r)
    })
    return filtered
  } else if (o instanceof Map) {
    const filtered = new Map<some, some>()
    each(o, (v, k) => {
      const r = f(v, k)
      if (r !== false) filtered.set(k, r)
    })
    return filtered
  } else {
    const filtered: some = {}
    each(o, (v, k) => {
      const r = f(v, k)
      if (r !== false) filtered[k] = r
    })
    return filtered
  }
}
export { filterMap }


// fill ---------------------------------------------------------------------------------
export function fill<V>(size: number, v: V | ((i: number) => V)): V[] {
  const f: ((i: number) => V) = typeof v == 'function' ? v as ((i: number) => V) : () => v
  const list: V[] = []
  for (let i = 0; i < size; i++) list.push(f(i))
  return list
}


// fill ---------------------------------------------------------------------------------
export function skipUndefined<V>(list: (V | undefined)[]): V[] {
  return filterMap(list, (v) => v !== undefined ? v : false)
}


// reject -------------------------------------------------------------------------
function reject<T>(list: Array<T>, f: Predicate<T, number>): Array<T>
function reject<T>(list: Array<T>, keys: number[]): Array<T>
function reject<T>(map: { [key: string]: T }, f: Predicate<T, string>): { [key: string]: T }
function reject<T>(map: { [key: string]: T }, keys: string[]): { [key: string]: T }
function reject(o: some, f: some) { return partition(o, f)[1] }
export { reject }

// uniq ---------------------------------------------------------------------------
export function unique<V, Key>(list: Array<V>, toKey?: (v: V) => Key): Array<V> {
  const set = new Set<some>()
  const _toKey = toKey || ((v: V) => v)
  return list.filter((v) => {
    const key = _toKey(v)
    if (set.has(key)) return false
    else {
      set.add(key)
      return true
    }
  })
}


// pick ---------------------------------------------------------------------------
function pick<T>(list: T[], keys: number[]): T[]
function pick<T, K extends keyof T>(list: T[], keys: K[]): T[]
function pick<T extends {}, K extends keyof T>(map: T, k: K[]): Pick<T, K>
function pick(o: some, keys: (string | number)[]) {
  return partition(o, (_v, i: some) => keys.includes(i))[0]
}
export { pick }
test("pick", () => {
  assert.equal(pick({ a: 1, b: 2 }, ['a']), { a: 1 } as some) // Not working in swelte
})


// ensure --------------------------------------------------------------------------------
export function ensure<V>(value: (V | undefined) | Found<V>, info?: string): V {
  if ((typeof value == 'object') && ('found' in value)) {
    if (!value.found) throw new Error((value as some).message || `value${info ? ' ' + info : ''} not found`)
    else              return value.value
  } else if ((typeof value == 'string')) {
    if (value == "") throw new Error(`string value${info ? ' ' + info : ''} not found`)
    else              return value
  } else {
    if (value === undefined) throw new Error(`value${info ? ' ' + info : ''} not defined`)
    else              return value
  }
}


// remove -------------------------------------------------------------------------
// function remove<V>(list: Array<V>, i: number): V | undefined
// function remove<V>(list: Array<V>, f: Predicate<V, number>): Array<V>
// function remove<V, K>(map: Map<K, V>, k: K): V | undefined
// function remove<V, K>(map: Map<K, V>, f: Predicate<V, K>): Map<K, V>
// function remove<V, K>(o: Array<V> | Map<K, V>, f: some) {
//   if (o instanceof Array) {
//     if (f instanceof Function) {
//       const [deleted, remained] = partition(o, f)
//       o.splice(0, remained.length, ...remained)
//       return deleted
//     } else {
//       if (f >= o.length) return undefined
//       const v = o[f]
//       o.splice(f, 1)
//       return v
//     }
//   } else {
//     if (f instanceof Function) {
//       const [deleted] = partition(o, f)
//       each(deleted, (_v, k) => delete o[k])
//       return deleted
//     } else {
//       if (!o.hasOwnProperty(f)) return undefined
//       const v = o[f]
//       delete o[f]
//       return v
//     }
//   }
// }
// export { remove }


// reduce -------------------------------------------------------------------------
function reduce<A, V>(list: V[], accumulator: A, f: (accumulator: A, v: V, key: number) => A): A
function reduce<A, V, K>(map: Map<K, V>, accumulator: A, f: (accumulator: A, v: V, key: number) => A): A
function reduce<A, V>(map: { [key: string]: V }, accumulator: A, f: (accumulator: A, v: V, key: string) => A): A
function reduce<A, V>(
  o: some, accumulator: A, f: (accumulator: A, v: V, key: some) => A
) {
  each(o as some, (v: some, i) => accumulator = f(accumulator, v, i))
  return accumulator
}
export { reduce }


// keys ---------------------------------------------------------------------------
function keys<V>(list: Array<V>): number[]
function keys<V, K>(map: Map<K, V>): K[]
// Adding `& string` because otherwise it would infer the type as `(string | number)[]`
// see https://stackoverflow.com/questions/51808160/keyof-inferring-string-number-when-key-is-only-a-string
function keys<T, O extends { [key: string]: T }>(map: O): (keyof O & string)[]
function keys<T>(o: some) {
  return reduce(o, [], (list: some, _v, k: some) => { list.push(k); return list })
}
export { keys }


// values --------------------------------------------------------------------------------
function values<T>(list: T[]): T[]
function values<T>(map: { [key: string]: T | undefined }): T[]
function values<K, T>(map: Map<K, T>): T[]
function values(o: some) {
  return reduce(o, [], (list: some, v) => { list.push(v); return list })
}
export { values }


// flatten -------------------------------------------------------------------------------
export function flatten<T>(list: T[][]): T[] {
  return reduce(list, [] as T[], (acc, v) => { acc.push(...v); return acc })
}


// sum -----------------------------------------------------------------------------------
export function sum(list: number[]): number {
  return reduce(list, 0, (sum, v) => sum + v)
}

// map ----------------------------------------------------------------------------
// function map<T, R>(list: T[], f: (v: T, i: number) => R): R[]
// function map<M extends {}, K extends keyof M, R>(map: M, f: (v: M[K], k: K) => R): { [key in K]: R }
// function map<T, R>(o: T[] | { [key: string]: T }, f: (v: T, k: some) => R) {
//   if (o instanceof Array) return o.map(f)
//   else {
//     const mapped = {} as some
//     each(o, (v, k) => mapped[k] = f(v, k))
//     return mapped
//   }
// }
// export { map }
function map<V, R>(list: V[], f: (v: V, i: number) => R): R[]
function map<K, V, R>(map: Map<K, V>, f: (v: V, k: K) => R): Map<K, R>
function map<M extends {}, K extends keyof M, R>(map: M, f: (v: M[K], k: K) => R): { [key in K]: R }
function map<K, V, R>(o: some, f: (v: V, k: some) => R) {
  if        (o instanceof Array) {
    return o.map(f)
  } else if (o instanceof Map) {
    const mapped = new Map<K, R>()
    each(o, (v, k) => mapped.set(k, f(v, k)))
    return mapped
  } else {
    const mapped = {} as some
    each(o, (v: some, k) => mapped[k] = f(v, k))
    return mapped
  }
}
export { map }


// round --------------------------------------------------------------------------
export function round(v: number, digits: number = 0): number {
  return digits == 0 ?
    Math.round(v) :
    Math.round((v + Number.EPSILON) * Math.pow(10, digits)) / Math.pow(10, digits)
}
test("round", () => {
  assert.equal(round(0.05860103881518906, 2), 0.06)
})


// shuffle ------------------------------------------------------------------------
export function shuffle<T>(list: T[], random?: () => number): T[] {
  if (random == undefined) random = () => Math.random()
  list = [...list]
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]]
  }
  return list
}


// debounce -----------------------------------------------------------------------
export function debounce<F extends ((...args: some[]) => void)>(fn: F, timeout: number, immediate = false): F {
  let timer: some = undefined
  return ((...args: some[]) => {
    if (immediate) {
      immediate = false
      fn(...args)
    } else {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => fn(...args), timeout)
    }
  }) as F
}


// // CustomError --------------------------------------------------------------------
// export class CustomError extends Error {
//   constructor(message: string) {
//     super(message)
//     Object.setPrototypeOf(this, CustomError.prototype)
//   }
// }


// NeverError ---------------------------------------------------------------------
export class NeverError extends Error {
  constructor(message: never) { super(`NeverError: ${message}`) }
}


// ensure_error -------------------------------------------------------------------
export function ensure_error(error: unknown, defaultMessage = "Unknown error"): Error {
  if (error && (typeof error == 'object') && (error instanceof Error)) {
    if (!error.message) error.message = defaultMessage
    return error
  } else {
    return new Error('' + (error || defaultMessage))
  }
  // return '' + ((error && (typeof error == 'object') && error.message) || defaultMessage)
}


// Error.toJSON -------------------------------------------------------------------
// Otherwise JSON will be empty `{}`
;(Error.prototype as some).toJSON = function(this: some) {
  return { message: this.message, stack: this.stack }
}

// Map.toJSON ---------------------------------------------------------------------
// Otherwise JSON will be empty `{}`
;(Map.prototype  as some).toJSON = function(this: some) {
  return reduce(this, {}, (map: some, v, k) => { map[k] = v; return map })
}


// Errorneous ----------------------------------------------------------------------------
export type Errorneous<R> = { isError: true, message: string } | { isError: false, value: R }
export type ErrorneousU<R> = { is_error: true, message: string } | { is_error: false, value: R }