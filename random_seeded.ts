import { something } from './base.ts'
import { createRequire } from 'https://deno.land/std/node/module.ts'

let seedrandom: (seed: number | string) => (() => number)
{
  let seedrandom_lib: something = undefined
  seedrandom = (seed) => {
    // Code for proper random generator is not simple, the library needed
    if (seedrandom_lib === undefined) {
      const require = createRequire(import.meta.url)
      seedrandom_lib = require("./vendor/seedrandom")
    }
    return seedrandom_lib('' + seed)
  }
}
export { seedrandom }
