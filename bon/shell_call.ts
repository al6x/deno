import { assert, Errorneous, something, p, ensureError, toJson } from './base.ts'

const jsonOutputToken = "shell_call_jsonOutput:"
export async function onShellCall<BeforeOutput>({ before, process, after } : {
  before:  (beforeInput: something) => Promise<BeforeOutput>,
  process: (beforeOputput: BeforeOutput, input: something) => Promise<something>,
  after:   (beforeOputput: BeforeOutput | undefined, afterInput: something) => Promise<void>
}): Promise<void> {
  assert.equal(Deno.args.length, 1, "only one argument expected")
  let data = JSON.parse(Deno.args[0])

  // Calling before
  let beforeOutput: Errorneous<BeforeOutput>
  try {
    beforeOutput = { isError: false, value: await before(data.before) }
  } catch (e) {
    beforeOutput = { isError: true, error: ensureError(e).message }
  }

  // Processing
  assert(Array.isArray(data.inputs), "inputs should be an array")
  let results: Errorneous<something>[] = []
  if (beforeOutput.isError) {
    results = data.inputs.map(() => beforeOutput)
  } else {
    for (let input of data.inputs) {
      try {
        let value = await process(beforeOutput.value, input)
        results.push({ isError: false, value })
      } catch (e) {
        results.push({ isError: true, error: ensureError(e).message })
      }
    }
  }

  // After
  try {
    await after(beforeOutput.isError ? undefined : beforeOutput.value, data.after) }
  catch (e) {
    results = data.inputs.map(() => ({ isError: true, error: ensureError(e).message }))
  }

  // Writing result to STDOUT
  const message = jsonOutputToken + toJson(results)
  await Deno.stdout.write((new TextEncoder()).encode(message))
  Deno.exit()
}