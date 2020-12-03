import { createHash } from 'https://deno.land/std/hash/mod.ts'

export function md5(data: number | string | ArrayBuffer): string {
  return createHash('md5').update(data instanceof ArrayBuffer ? data : ('' + data)).toString('hex')
}