import './base.ts'
import { io } from './deps.ts'

const jsonOutputToken = "shell_call_json_output:"
export async function on_shell_call<BeforeOutput>({ before, process, after } : {
  before:  (beforeInput: any) => Promise<BeforeOutput>,
  process: (beforeOputput: BeforeOutput, input: any) => Promise<any>,
  after:   (beforeOputput: BeforeOutput | undefined, afterInput: any) => Promise<void>
}) {
  assert.equal(Deno.args.length, 1, "only one argument expected")
  let data = JSON.parse(Deno.args[0])

  // Calling before
  let beforeOutput: E<BeforeOutput>
  try {
    beforeOutput = { is_error: false, value: await before(data.before) }
  } catch (e) {
    beforeOutput = { is_error: true, message: ensure_error(e).message }
  }

  // Processing
  assert(Array.isArray(data.inputs), "inputs should be an array")
  let results: E<any>[] = []
  if (beforeOutput.is_error) {
    results = data.inputs.map(() => beforeOutput)
  } else {
    for (let input of data.inputs) {
      try {
        let value = await process(beforeOutput.value, input)
        results.push({ is_error: false, value })
      } catch (e) {
        results.push({ is_error: true, message: ensure_error(e).message })
      }
    }
  }

  // After
  try {
    await after(beforeOutput.is_error ? undefined : beforeOutput.value, data.after) }
  catch (e) {
    results = data.inputs.map(() => ({ is_error: true, error: ensure_error(e).message }))
  }

  // Writing result to STDOUT
  const message = jsonOutputToken + to_json(results)
  await io.writeAll(Deno.stdout, (new TextEncoder()).encode(message))
  Deno.exit()
}