import { createRequire } from 'https://deno.land/std/node/module.ts'
console.log('remove deno require')
let seedrandom: (seed: number | string) => (() => number)
{
  let seedrandomLib: any = undefined
  seedrandom = (seed) => {
    // Code for proper random generator is not simple, the library needed
    if (seedrandomLib === undefined) {
      const require = createRequire(import.meta.url)
      seedrandomLib = require("./vendor/seedrandom")
    }
    return seedrandomLib('' + seed)
  }
}
export { seedrandom }
