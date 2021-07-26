import { assert, test, sortBy, round, fill, filterMap, findi, p } from './base.ts'


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


// mean ----------------------------------------------------------------------------------
export function mean(values: number[]): number {
  let sum = 0
  for (const v of values) sum += v
  return sum / values.length
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


// minMaxNorm --------------------------------------------------------------------------
export function minMaxNorm(values: number[], min: number, max: number): number[] {
  return values.map((v) => (v - min) / (max - min))
}


// mapWithRank -------------------------------------------------------------------------
// Attach to every element its rank in the ordered list, ordered according to `orderBy` function.
export function mapWithRank<V, R>(list: V[], orderBy: (v: V) => number, map: (v: V, rank: number) => R): R[] {
  // Sorting accourding to rank
  const listWithIndex = list.map((v, i) => ({ v, originalI: i, orderBy: orderBy(v) }))
  const sorted = sortBy(listWithIndex, ({ orderBy }) => orderBy)

  // Adding rank, if values returned by `orderBy` are the same, the rank also the same
  const sortedWithRank: { v: V, originalI: number, orderBy: number, rank: number }[] = []
  let rank = 1
  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]
    if (i > 0 && current.orderBy != sorted[i - 1].orderBy) rank++
    sortedWithRank.push({ ...current, rank })
  }

  // Restoring original order and mapping
  const originalWithRank = sortBy(sortedWithRank, ({ originalI }) => originalI)
  return originalWithRank.map(({ v, rank }) => map(v, rank))
}
test(mapWithRank, () => {
  assert.equal(
    mapWithRank(
      [ 4,        2,        3,        4,        5,        7,        5], (v) => v, (v, r) => [v, r]
    ),
    [ [ 4, 3 ], [ 2, 1 ], [ 3, 2 ], [ 4, 3 ], [ 5, 4 ], [ 7, 5 ], [ 5, 4 ] ]
  )
})


// linearRegression ---------------------------------------------------------------------
// https://stackoverflow.com/questions/6195335/linear-regression-in-javascript
// return (a, b) that minimize
// sumI rI * (a*xI+b - yI)^2
//
// Is wrong for EXPE
function linearRegressionWrong(xy:  [number, number][]): [number, number]
function linearRegressionWrong(xyr: [number, number, number][]): [number, number]
function linearRegressionWrong(arg: [number, number, number?][]): [number, number] {
  const xyr = arg.map(([x, y, r]) => [x, y, r === undefined ? 1 : r])
  let i,
      x, y, r,
      sumx=0, sumy=0, sumx2=0, sumy2=0, sumxy=0, sumr=0,
      a, b

  for(i=0; i<xyr.length; i++) {
      // this is our data pair
      x = xyr[i][0], y = xyr[i][1]

      // this is the weight for that pair
      // set to 1 (and simplify code accordingly, ie, sumr becomes xy.length) if weighting is not needed
      r = xyr[i][2]

      // consider checking for NaN in the x, y and r variables here
      // (add a continue statement in that case)

      sumr += r
      sumx += r*x
      sumx2 += r*(x*x)
      sumy += r*y
      sumy2 += r*(y*y)
      sumxy += r*(x*y)
  }

  // note: the denominator is the variance of the random variable X
  // the only case when it is 0 is the degenerate case X==constant
  b = (sumy*sumx2 - sumx*sumxy)/(sumr*sumx2-sumx*sumx)
  a = (sumr*sumxy - sumx*sumy)/(sumr*sumx2-sumx*sumx)

  return [a, b]
}
export { linearRegressionWrong as linearRegression }


// differentiate -------------------------------------------------------------------------
// Calculating differences for sparce values
export function differentiate(sparceValues: (number | undefined)[]): (number | undefined)[] {
  const diffs = fill<number | undefined>(sparceValues.length, undefined)

  // Converting sparce values to list of defined values and its indices
  const values = filterMap(sparceValues, (v, i) => v !== undefined ? [i, v] : false)

  let indexConsistencyCheck = values[0][0]
  for (let j = 0; j < values.length - 1; j++) {
    const [i1, v1] = values[j], [i2, v2] = values[j + 1]

    // Calculating the diff for the whole `i1-i2` span and diff for every i
    const spanDiff = v2 / v1
    if (spanDiff <= 0) throw new Error(`differentiate expect positive values`)
    const diffI    = Math.pow(spanDiff, 1/(i2 - i1))

    for (let i = i1; i < i2; i++) {
      assert.equal(indexConsistencyCheck, i)
      diffs[i + 1] = diffI
      indexConsistencyCheck += 1
    }
  }

  assert(diffs[0] === undefined, `first element of diff serie should always be undefined`)
  return diffs
}
test(differentiate, () => {
  const u = undefined
  assert.equal(differentiate([
    u,   1,   u,   u,   8,   u,   u,   1, u
  ]), [
    u,   u,   2,   2,   2, 0.5, 0.5, 0.5, u
  ])

  assert.equal(differentiate([
    u,   1,   u,   u,   8
  ]), [
    u,   u,   2,   2,   2
  ])

  // Annual revenues
  assert.equal(differentiate([
    //  1,     2,     3,     4,     5,     6,     7,     8,     9,    10,    11,    12
        u,     u,     u,     u,     u,     1,     u,     u,     u,     u,     u,     u, // 2000-06
        u,     u,     u,     u,     u,   1.1,     u,     u,     u,     u,     u,     u, // 2001-06
        u,     u,     u,     u,     u,   1.2                                            // 2002-06
  ]).map((v) => v ? round(v, 3) : v), [
    //  1,     2,     3,     4,     5,     6,     7,     8,     9,    10,    11,    12
        u,     u,     u,     u,     u,     u, 1.008, 1.008, 1.008, 1.008, 1.008, 1.008,
    1.008, 1.008, 1.008, 1.008, 1.008, 1.008, 1.007, 1.007, 1.007, 1.007, 1.007, 1.007,
    1.007, 1.007, 1.007, 1.007, 1.007, 1.007
  ])

  // Should check for negative values
  let errorMessage = undefined
  try { differentiate([u,  1, u, -1]) }
  catch (e) { errorMessage = e.message }
  assert.equal(errorMessage, `differentiate expect positive values`)
})


// integrate -----------------------------------------------------------------------------
// Calculating integral, gaps not allowed
export function integrate(diffs: (number | undefined)[], base = 1): (number | undefined)[] {
  assert(diffs[0] === undefined, `first element of diff serie should always be undefined`)
  const values = fill<number | undefined>(diffs.length, undefined)
  const firstDefinedI = findi(diffs, (v) => v !== undefined)
  if (!firstDefinedI) throw new Error(`the whole diffs serie is undefined`)
  values[firstDefinedI - 1] = base
  for (let i = firstDefinedI; i < diffs.length - 1; i++) {
    const di = diffs[i]
    if (di === undefined) break
    const previousV = values[i-1]
    if (previousV === undefined) throw new Error('internal error, there could be no undefined spans in values')
    values[i] = previousV * di
  }
  return values
}
test(integrate, () => {
  const u = undefined
  assert.equal(integrate([
    u,   u,   2,   2,   2, 0.5, 0.5, 0.5, u
  ]), [
    u,   1,   2,   4,   8,   4,   2,   1, u
  ])
})


// // mean_absolute_deviation ---------------------------------------------------------------
// export function mean_absolute_deviation(values: number[]) {
//   const m = mean(values)
//   return mean(values.map((v) => m - v))
// }