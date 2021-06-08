type some = any
type SimpleTypes = number | string

export class Hash<V, K extends SimpleTypes = string> {
  public  readonly length = 0
  private readonly _map = new Map<K, V>()

  constructor()
  constructor(map: { [key in K]: V })
  constructor(list: [K, V][])
  constructor(list: V[], toK: (v: V) => K)
  constructor(collection?: { [key in K]: V } | [K, V][] | V[], toKey?: (v: V) => K) {
    if (collection) {
      if (Array.isArray(collection)) {
        if (toKey) {
          const list = collection as V[]
          for (let i = 0; i < list.length; i++) this._map.set(toKey(list[i]), list[i])
        } else {
          const list = collection as [K, V][]
          for (let i = 0; i < list.length; i++) this._map.set(list[i][0], list[i][1])
        }
      } else {
        for (const k in collection) this._map.set(k, collection[k])
      }
    }
  }

  has(k: K): boolean { return this._map.has(k) }


  get(k: K): V | undefined
  get(k: K, dv: V): V
  get(k: K, dv: (k: K) => V): V
  get(k: K, dv?: V | ((k: K) => V)): V | undefined {
    let v = this._map.get(k)
    if (v !== undefined) return v

    if (dv !== undefined) {
      v = typeof dv == 'function' ? (dv as (k: K) => V)(k) : dv
      this._map.set(k, v)
      return v
    }

    return undefined
  }


  ensureGet(k: K): V {
    const v = this._map.get(k)
    if (v === undefined) throw new Error(`map expected to have key '${k}'`)
    return v
  }


  set(k: K, v: V): void {
    this._map.set(k, v)
    ;(<{ length: number }>this).length = this._map.size
  }


  delete(k: K): V | undefined {
    const v = this.get(k)
    this._map.delete(k)
    ;(<{ length: number }>this).length = this._map.size
    return v
  }


  each(f: (v: V, k: K) => void): void { this._map.forEach(f) }


  map<R>(f: (v: V, k: K) => R): Hash<R, K> {
    const r = new Hash<R, K>()
    this.each((v, k) => r.set(k, f(v, k)))
    return r
  }


  entries(): [K, V][] { return Array.from(this._map) }


  keys(): K[] { return Array.from(this._map.keys()) }


  values(): V[] { return Array.from(this._map.values()) }

  toJSON() { return (this._map as some).toJSON() }
}