import './base.ts'


export function parse_number(
  s: string, { check, on_error }: {
    check?:    ((n: number) => boolean),
    on_error?: (s: string) => string
  } = {}
): number {
  let v = s.downcase().trim()
  const do_check = (n: number) => { if (check && !check(n)) throw new Error(`check for number ${s} failed`) }

  // Replacing trailing zeros in reminder, like `100.20` => `100.2`
  if (/\./.test(v)) v = v.replace(/\.?0+$/, '')

  // Replacing trailing 'K' with thousand, like `100k` => `100000`
  let multiplier = 1
  if (/k$/i.test(v)) {
    v = v.replace(/\k$/i, '')
    multiplier = 1000
  }

  // Replacing trailing 'M' with millions, like `100m` => `100000000`
  if (/m$/i.test(v)) {
    v = v.replace(/\m$/i, '')
    multiplier = 1000000
  }

  v = v
    .replace(/,/g, '') // Replacing commas
    .replace(/\.0+/, '') // Replacing trailing zeroes, like 4.0
    .replace(/\.$/, '') // Replacing trailing dot, like "999,000."

  const i = parseInt(v)
  if (('' + i) == v && is_number(i)) {
    do_check(i)
    return i * multiplier
  }
  const f = parseFloat(v)
  if (('' + f) == v && is_number(f)) {
    do_check(f)
    return f * multiplier
  }
  throw new Error(on_error ? on_error(s) : `invalid number '${s}'`)
}
test(parse_number, () => {
  assert.equal(parse_number('1,206.57'), 1206.57)
  assert.equal(parse_number('0.0'), 0)
  assert.equal(parse_number('1.0'), 1)
  assert.equal(parse_number('100'), 100)
  assert.equal(parse_number('0'), 0)
  assert.equal(parse_number('183.70'), 183.7)
  assert.equal(parse_number('120K'), 120000)
  assert.equal(parse_number('120.1K'), 120100)
  assert.equal(parse_number('1.395m'), 1395000)
  assert.equal(parse_number('7.5 '), 7.5)
  assert.equal(parse_number('4.0M'), 4000000)
  assert.equal(parse_number('999,000.'), 999000)
})

export function parse_string(
  s: string, { blank, check, trim }: { blank?: boolean, trim?: boolean, check?: ((s: string) => boolean) } = {}
): string {
  // Default options
  if (blank === undefined) blank = false
  if (trim === undefined)  trim  = true

  assert(typeof s == 'string', () => `string required but get '${typeof s}' instead`)
  if (blank === false) assert(/[^\s\t\n]+/.test(s), `blank string not allowed`)
  if (trim) s = s.replace(/^[\s\t\n]+|[\s\t\n]+$/g, '')

  if (check && !check(s)) throw new Error(`check for string '${s}' failed`)
  return s
}
test(parse_string, () => {
  assert.equal(parse_string(' a b '), 'a b')
})


// parse_boolean -------------------------------------------------------------------------
export function parse_boolean(
  v: string | boolean | undefined, options: { default?: boolean } = {}
): boolean {
  if (typeof v === 'string') {
    v = v.toLowerCase()
    if      (v == 'true')  return true
    else if (v == 'false') return false
    else if (v == '') {
      if (options.default !== undefined) return options.default
      else throw new Error(`boolean required but got empty string`)
    }
    else {
      throw new Error(`unknown boolean value '${v}'`)
    }
  } else if (typeof v === 'undefined') {
    if (options.default !== undefined) return options.default
    else throw new Error(`boolean required but got undefined value`)
  } else if (typeof v === 'boolean') {
    return v
  } else {
    throw new Error(`unknown type of boolean value '${typeof v}'`)
  }
}


export function clean(text: string): string { return text.replace(/^[\t\s\n]+|[\t\s\n]+$/g, '') }


export function ensure_string(v: string, allow_empty?: boolean, info?: string): string
export function ensure_string(v: string, info?: string): string
export function ensure_string(v: string, arg1?: string | boolean, arg2?: string): string {
  let allow_empty = false, info = "not empty string expected"
  if (is_boolean(arg1))     allow_empty = arg1
  else if (is_string(arg1)) info = arg1
  if (is_string(arg2))      info = arg2

  if (is_string(v) && (!v.is_empty() || allow_empty)) return v
  throw new Error(info)
}


export function ensure_string_or_undefined(
  v: string | undefined, info = "string or undefined expected"
): string | undefined {
  if (v === null || is_undefined(v)) return undefined
  if (is_string(v)) return v.is_empty() ? undefined : v
  throw new Error(info)
}


export function ensure_number(v: number, info = "number expected"): number {
  if (is_number(v)) return v
  throw new Error(info)
}


export function ensure_number_or_undefined(
  v: number | undefined, info = "number or undefined expected"
): number | undefined {
  if (v === null) return undefined
  if (is_undefined(v) || is_number(v)) return v
  throw new Error(info)
}


export function ensure_array<T = any>(v: T[], info = "array expected"): T[] {
  if (is_array(v)) return v
  throw new Error(info)
}


export function ensure_object<T extends object>(v: T, info = "object expected"): T {
  if (is_object(v)) return v
  throw new Error(info)
}


export function ensure_object_or_undefined<T extends object>(
  v: T | undefined, info = "object expected"
): T | undefined {
  if (v === null) return undefined
  if (is_undefined(v) || is_object(v)) return v
  throw new Error(info)
}


export function ensure_boolean(v: boolean, info = "boolean expected"): boolean {
  if (is_boolean(v)) return v
  throw new Error(info)
}

export function ensure_boolean_or_undefined(
  v: boolean | undefined, info = "boolean or undefined expected"
): boolean | undefined {
  if (v === null) return undefined
  if (is_undefined(v) || is_boolean(v)) return v
  throw new Error(info)
}