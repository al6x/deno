type SimpleTypes = number | string | boolean

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
  i: number, keys: SimpleTypes[], value: V, store: Map<SimpleTypes, any>, mmap: MultiMap<V, SimpleTypes[]>
) {
  const key = keys[i]
  if (i == keys.length - 1) {
    if (!store.has(key)) (<{ length: number }>mmap).length += 1
    store.set(key, value)
  } else {
    let nextStore = store.get(key)
    if (nextStore === undefined) {
      nextStore = new Map<SimpleTypes, V>()
      store.set(key, nextStore)
    }
    set(i + 1, keys, value, nextStore, mmap)
  }
}

function has(i: number, keys: SimpleTypes[], store: Map<SimpleTypes, any>): boolean {
  if (i == keys.length - 1) return store.has(keys[i])
  else {
    const nextStore = store.get(keys[i])
    return nextStore !== undefined ? has(i + 1, keys, nextStore) : false
  }
}

function get<V>(i: number, keys: SimpleTypes[], store: Map<SimpleTypes, any>): V | undefined {
  if (i == keys.length - 1) return store.get(keys[i])
  else {
    const nextStore = store.get(keys[i])
    return nextStore !== undefined ? get(i + 1, keys, nextStore) : undefined
  }
}

function del<V>(
  i: number, keys: SimpleTypes[], store: Map<SimpleTypes, any>, mmap: MultiMap<V, SimpleTypes[]>
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
    let nextStore = store.get(key)
    if (nextStore === undefined) return undefined
    const v = del(i + 1, keys, nextStore, mmap)
    if (nextStore.length == 0) store.delete(key)
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