import { something, hour, stable_json_stringify, p } from './base.ts'
import * as fs from './fs.ts'
import { MultiMap } from './multi_map.ts'
import { md5 } from './md5.ts'

// cache_fn ------------------------------------------------------------------------------
// Function should have simple arguments like string, number, boolean
export function cache_fn<Fn extends (...args: something) => something>(
  fn: Fn, to_key?: ((...args: Parameters<Fn>) => (number | boolean | string)[])
): Fn {
  const cache = new MultiMap<something, something>()
  let no_args_cashe: something = undefined
  return ((...args: something[]) => {
    if (args.length == 0) {
      if (!no_args_cashe) no_args_cashe = fn()
      return no_args_cashe
    } else {
      const key = to_key ? to_key(...args as something) : args
      let value = cache.get(key)
      if (!value) {
        // Ensuring args are of simple types, null or undefined are not allowed
        key.map((arg) => {
          const type = typeof arg
          if (type != 'string' && type != 'boolean' && type != 'number')
            throw new Error(
              `arguments for function ${fn.name} cached with cache_fn should be of simple types` +
              ` but it's '${type}'`
            )
        })

        value = fn(...args)
        cache.set(key, value)
      }
      return value
    }
  }) as something
}


// cache_fs ------------------------------------------------------------------------------
interface CacheData { value: something, timestamp: number }
export function cache_fs<Fn extends Function>(key: string, fn: Fn, options: {
  cache_path:  string
  expiration?: number
}) {
  let value: something = undefined
  return ((...args: something[]) => {
    if (value === undefined) {
      const expiration = options.expiration || 1 * hour
      const path = fs.resolve(options.cache_path, 'cache', key + '_' + md5(stable_json_stringify(args)))

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
  }) as something
}