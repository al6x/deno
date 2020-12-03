import { assert, Errorneous, something, p, ensure_error, stable_json_stringify } from './base.ts'

const json_output_token = "shell_call_json_output:"
export async function on_shell_call<BeforeOutput>({ before, process, after } : {
  before:  (before_input: something) => Promise<BeforeOutput>,
  process: (before_oputput: BeforeOutput, input: something) => Promise<something>,
  after:   (before_oputput: BeforeOutput | undefined, after_input: something) => Promise<void>
}): Promise<void> {
  assert.equal(Deno.args.length, 1, "only one argument expected")
  let data = JSON.parse(Deno.args[0])

  // Calling before
  let before_output: Errorneous<BeforeOutput>
  try {
    before_output = { is_error: false, value: await before(data.before) }
  } catch (e) {
    before_output = { is_error: true, error: ensure_error(e).message }
  }

  // Processing
  assert(Array.isArray(data.inputs), "inputs should be an array")
  let results: Errorneous<something>[] = []
  if (before_output.is_error) {
    results = data.inputs.map(() => before_output)
  } else {
    for (let input of data.inputs) {
      try {
        let value = await process(before_output.value, input)
        results.push({ is_error: false, value })
      } catch (e) {
        results.push({ is_error: true, error: ensure_error(e).message })
      }
    }
  }

  // After
  try {
    await after(before_output.is_error ? undefined : before_output.value, data.after) }
  catch (e) {
    results = data.inputs.map(() => ({ is_error: true, error: ensure_error(e).message }))
  }

  // Writing result to STDOUT
  const message = json_output_token + stable_json_stringify(results)
  await Deno.stdout.write((new TextEncoder()).encode(message))
  Deno.exit()
}