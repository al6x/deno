type SimpleTypes = number | string | boolean
type something = any

// Map where keys could be an array of simple types.
export class MultiMap<V, K extends SimpleTypes[] = string[]> {
  public    readonly length = 0
  protected readonly _map = new Map<SimpleTypes, V>()

  set (keys: K, value: V): void { set(0, keys, value, this._map, this) }

  has (keys: K) { return has(0, keys, this._map) }

  get (keys: K) { return get(0, keys, this._map) }

  delete (keys: K): V | undefined { return del(0, keys, this._map, this) }
}

function set<V>(
  i: number, keys: SimpleTypes[], value: V, store: Map<SimpleTypes, something>, mmap: MultiMap<V, SimpleTypes[]>
) {
  const key = keys[i]
  if (i == keys.length - 1) {
    if (!store.has(key)) (<{ length: number }>mmap).length += 1
    store.set(key, value)
  } else {
    let next_store = store.get(key)
    if (next_store === undefined) {
      next_store = new Map<SimpleTypes, V>()
      store.set(key, next_store)
    }
    set(i + 1, keys, value, next_store, mmap)
  }
}

function has(i: number, keys: SimpleTypes[], store: Map<SimpleTypes, something>): boolean {
  if (i == keys.length - 1) return store.has(keys[i])
  else {
    const next_store = store.get(keys[i])
    return next_store !== undefined ? has(i + 1, keys, next_store) : false
  }
}

function get<V>(i: number, keys: SimpleTypes[], store: Map<SimpleTypes, something>): V | undefined {
  if (i == keys.length - 1) return store.get(keys[i])
  else {
    const next_store = store.get(keys[i])
    return next_store !== undefined ? get(i + 1, keys, next_store) : undefined
  }
}

function del<V>(
  i: number, keys: SimpleTypes[], store: Map<SimpleTypes, something>, mmap: MultiMap<V, SimpleTypes[]>
): V | undefined {
  const key = keys[i]
  if (i == keys.length - 1) {
    const v = store.get(key)
    if (v !== undefined) {
      store.delete(keys[i])
      ;(<{ length: number }>mmap).length -= 1
    }
    return v
  } else {
    let next_store = store.get(key)
    if (next_store === undefined) return undefined
    const v = del(i + 1, keys, next_store, mmap)
    if (next_store.length == 0) store.delete(key)
    return v
  }
}

// Test ----------------------------------------------------------------------------------
// const mm = new MultiMap<number>()
// mm.set(['a', 'b'], 1)
// console.log(mm.length)
// console.log(mm.get(['a', 'b']))
// mm.delete(['a', 'b'])
// console.log(mm.get(['a', 'b']))
// console.log(mm.length)