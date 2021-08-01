import { hour } from './base.ts'
import * as fs from './fs.ts'
import { MultiMap } from './multi_map.ts'
import * as crypto from './crypto.ts'

// cacheFn ------------------------------------------------------------------------------
// Function should have simple arguments like string, number, boolean
export function cacheFn<Fn extends (...args: any) => any>(
  fn: Fn, toKey?: ((...args: Parameters<Fn>) => (number | boolean | string)[])
): Fn {
  const cache = new MultiMap<any, any>()
  let noArgsCashe: any = undefined
  return ((...args: any[]) => {
    if (args.length == 0) {
      if (!noArgsCashe) noArgsCashe = fn()
      return noArgsCashe
    } else {
      const key = toKey ? toKey(...args as any) : args
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
  }) as any
}


// cacheFs ------------------------------------------------------------------------------
interface CacheData { value: any, timestamp: number }
export function cacheFs<Fn extends Function>(key: string, fn: Fn, options: {
  cachePath:  string
  expiration?: number
}) {
  let value: any = undefined
  return ((...args: any[]) => {
    if (value === undefined) {
      const expiration = options.expiration || 1 * hour
      const path = fs.resolve(options.cachePath, 'cache', key + '_' + crypto.hash(to_json(args), 'md5'))

      // Reading value from file if exists
      if (fs.exists_sync(path)) {
        const data: CacheData = JSON.parse(fs.read_file_sync(path, { encoding: 'utf8' }))
        if ((data.timestamp + expiration) > Date.now()) value = data.value
      }

      // If value doesn't exists on fs - calculating and saving
      if (!value) {
        value = fn(...args)
        const data: CacheData = { value, timestamp: Date.now() }

        // Writing without waiting for success
        fs.write_file(path, JSON.stringify(data))
      }
    }
    return value
  }) as any
}