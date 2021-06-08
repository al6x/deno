import { some, hour, toJson, p } from './base.ts'
import * as fs from './fs.ts'
import { MultiMap } from './multi_map.ts'
import { md5 } from './md5.ts'

// cacheFn ------------------------------------------------------------------------------
// Function should have simple arguments like string, number, boolean
export function cacheFn<Fn extends (...args: some) => some>(
  fn: Fn, toKey?: ((...args: Parameters<Fn>) => (number | boolean | string)[])
): Fn {
  const cache = new MultiMap<some, some>()
  let noArgsCashe: some = undefined
  return ((...args: some[]) => {
    if (args.length == 0) {
      if (!noArgsCashe) noArgsCashe = fn()
      return noArgsCashe
    } else {
      const key = toKey ? toKey(...args as some) : args
      let value = cache.get(key)
      if (!value) {
        // Ensuring args are of simple types, null or undefined are not allowed
        key.map((arg) => {
          const type = typeof arg
          if (type != 'string' && type != 'boolean' && type != 'number')
            throw new Error(
              `arguments for function ${fn.name} cached with cacheFn should be of simple types` +
              ` but it's '${type}'`
            )
        })

        value = fn(...args)
        cache.set(key, value)
      }
      return value
    }
  }) as some
}


// cacheFs ------------------------------------------------------------------------------
interface CacheData { value: some, timestamp: number }
export function cacheFs<Fn extends Function>(key: string, fn: Fn, options: {
  cachePath:  string
  expiration?: number
}) {
  let value: some = undefined
  return ((...args: some[]) => {
    if (value === undefined) {
      const expiration = options.expiration || 1 * hour
      const path = fs.resolve(options.cachePath, 'cache', key + '_' + md5(toJson(args)))

      // Reading value from file if exists
      if (fs.existsSync(path)) {
        const data: CacheData = JSON.parse(fs.read_file_sync(path, { encoding: 'utf8' }))
        if ((data.timestamp + expiration) > Date.now()) value = data.value
      }

      // If value doesn't exists on fs - calculating and saving
      if (!value) {
        value = fn(...args)
        const data: CacheData = { value, timestamp: Date.now() }

        // Writing without waiting for success
        fs.writeFile(path, JSON.stringify(data))
      }
    }
    return value
  }) as some
}