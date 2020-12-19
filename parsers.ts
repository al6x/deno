import { is_number, test, assert } from './base.ts'

// parse_number --------------------------------------------------------------------------
export function parse_number(
  s: string, { check, on_error }: {
    check?:    ((n: number) => boolean),
    on_error?: (s: string) => string
  } = {}
): number {
  let v = trim(s.toLowerCase())
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
test(() => {
  assert.equal(parse_number('1,206.57'), 1206.57)
  assert.equal(parse_number('0.0'), 0)
  assert.equal(parse_number('1.0'), 1)
  assert.equal(parse_number('100'), 100)
  assert.equal(parse_number('0'), 0)
  assert.equal(parse_number('183.70'), 183.7)
  assert.equal(parse_number('120K'), 120000)
  assert.equal(parse_number('7.5 '), 7.5)
})


// trim --------------------------------------------------------------------------------------------
export function trim(text: string): string { return text.replace(/^[\t\s\n]+|[\t\s\n]+$/g, '') }