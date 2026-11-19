import { copyFile, mkdir, readFile, readdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const from = (path) => new URL('../' + path, import.meta.url)
const root = 'public/vision/'
const wasm = 'node_modules/@mediapipe/tasks-vision/wasm/'
const model = 'node_modules/ptmaker-vision-models/hand_landmarker.task'
const digest = createHash('sha256').update(await readFile(from(model))).digest('hex')
if (digest !== 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1') {
  throw new Error('Hand Landmarker model checksum mismatch.')
}
await mkdir(from(root + 'wasm'), { recursive: true })
await copyFile(from(model), from(root + 'hand_landmarker.task'))
for (const name of await readdir(from(wasm))) {
  if (/\.(wasm|js)$/.test(name)) await copyFile(from(wasm + name), from(root + 'wasm/' + name))
}
console.log('Installed local Hand Landmarker model and WASM.')
