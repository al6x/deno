import './base.ts'


// parse_number --------------------------------------------------------------------------
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
  if (/k$/.test(v)) v = v.replace(/\k$/, '000')

  // Replacing commas
  v = v.replace(/,/g, '')

  const i = parseInt(v)
  if (('' + i) == v && is_number(i)) {
    do_check(i)
    return i
  }
  const f = parseFloat(v)
  if (('' + f) == v && is_number(f)) {
    do_check(f)
    return f
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
  assert.equal(parse_number('7.5 '), 7.5)
})


// parse_string --------------------------------------------------------------------------
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

// clean ------------------------------------------------------------
export function clean(text: string): string { return text.replace(/^[\t\s\n]+|[\t\s\n]+$/g, '') }