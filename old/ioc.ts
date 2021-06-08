import { p, some } from "base/base.ts"

const instances = new Map<string, some>()

export function getInstance<T>(klass: { new (...args: some): T }, id = "default"): T {
  const type = klass.name
  const instance = instances.get(`${type}.${id}`)
  if (!instance) throw new Error(`can't find instance of ${type} with id '${id}'`)
  return instance
}

function setInstance(instance: object): void
function setInstance(instance: object, override: boolean): void
function setInstance(instance: object, id: string): void
function setInstance(instance: object, id: string, override: boolean): void
function setInstance(instance: object, arg2?: string | boolean, arg3?: boolean): void {
  const type = instance.constructor.name

  let argId      = typeof arg2 == "string" ? arg2 : undefined
  let instanceId = "id" in instance ? (instance as some).id : undefined
  if ((argId || instanceId) != (instanceId || argId)) throw new Error(`${type} instance id doesn't match`)
  let id: string = argId || instanceId || "default"

  let arg2Override = typeof arg2 == "boolean" ? arg2 : false
  let arg3Override = typeof arg3 == "boolean" ? arg3 : false
  let override = arg2Override || arg3Override

  if (instances.has(id) && !override) throw new Error(`can't redefine ${type} instance with id ${id}`)
  instances.set(`${type}.${id}`, instance)
}
export { setInstance }