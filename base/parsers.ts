import { isNumber, test, assert } from './base.ts'

// parseNumber --------------------------------------------------------------------------
export function parseNumber(
  s: string, { check, onError }: {
    check?:    ((n: number) => boolean),
    onError?: (s: string) => string
  } = {}
): number {
  let v = trim(s.toLowerCase())
  const doCheck = (n: number) => { if (check && !check(n)) throw new Error(`check for number ${s} failed`) }

  // Replacing trailing zeros in reminder, like `100.20` => `100.2`
  if (/\./.test(v)) v = v.replace(/\.?0+$/, '')

  // Replacing trailing 'K' with thousand, like `100k` => `100000`
  if (/k$/.test(v)) v = v.replace(/\k$/, '000')

  // Replacing commas
  v = v.replace(/,/g, '')

  const i = parseInt(v)
  if (('' + i) == v && isNumber(i)) {
    doCheck(i)
    return i
  }
  const f = parseFloat(v)
  if (('' + f) == v && isNumber(f)) {
    doCheck(f)
    return f
  }
  throw new Error(onError ? onError(s) : `invalid number '${s}'`)
}
test(() => {
  assert.equal(parseNumber('1,206.57'), 1206.57)
  assert.equal(parseNumber('0.0'), 0)
  assert.equal(parseNumber('1.0'), 1)
  assert.equal(parseNumber('100'), 100)
  assert.equal(parseNumber('0'), 0)
  assert.equal(parseNumber('183.70'), 183.7)
  assert.equal(parseNumber('120K'), 120000)
  assert.equal(parseNumber('7.5 '), 7.5)
})


// trim --------------------------------------------------------------------------------------------
export function trim(text: string): string { return text.replace(/^[\t\s\n]+|[\t\s\n]+$/g, '') }