// import { spawn, SpawnOptions } from 'child_process'
// import { StringDecoder } from 'string_decoder'

// export function run(
//   cmd: string, args: string[] = [], options: SpawnOptions = {}
// ): Promise<{ out: string, stdout: string, stderr: string }> {
//   Deno.run

//   return new Promise((resolve, reject) => {
//     let outdecoder = new StringDecoder('utf8'), stdoutdecoder = new StringDecoder('utf8'),
//       stderrdecoder = new StringDecoder('utf8')
//     let out: string[] = [], stdout: string[] = [], stderr: string[] = []
//     let workers = spawn(cmd, args, options)
//     workers.on('error', (err)  => reject(err))
//     workers.on('close', (code) => {
//       if (code == 0) resolve({ out: out.join(''), stdout: stdout.join(''), stderr: stderr.join('') })
//       else reject(new Error(`${cmd} ${args.join(' ')} exited with ${code}`))
//     })
//     workers.stdout!.on('data', (data) => {
//       out.push(outdecoder.write(data))
//       stdout.push(stdoutdecoder.write(data))
//     })
//     workers.stderr!.on('data', (data) => {
//       out.push(outdecoder.write(data))
//       stderr.push(stderrdecoder.write(data))
//     })
//   })
// }