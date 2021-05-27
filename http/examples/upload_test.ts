const form = new FormData()
let fileAsArrayBuffer = await Deno.readFile("./http/examples/plot.png")
let fileAsBlob = new Blob([fileAsArrayBuffer])
form.append("plot.png", fileAsBlob, "plog.png")

const res = await fetch('http://localhost/upload', { method: 'post', body: form })
console.log(res)