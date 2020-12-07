// import { spawn, SpawnOptions } from 'child_process'
// import { StringDecoder } from 'string_decoder'

export interface RunOptions {
  cwd?: string
  env?: {
    [key: string]: string
  }
}

// TODO add kill by timeout using `process.kill`
export async function run(
  // Arguments to pass, first element needs to be a path to the binary
  cmd:     string[] | [URL, ...string[]],
  options: RunOptions = {}
): Promise<{ code: number, output: string, stderr: string }> {
  const process = Deno.run({
    cmd,
    ...options,
    stdout: "piped",
    stderr: "piped",
    stdin:  "piped"
  })
  const decoder = new TextDecoder('utf-8')
  const { code } = await process.status()
  const output = decoder.decode(await process.output())
  const stderr = decoder.decode(await process.stderrOutput())
  return { code, output, stderr }
}