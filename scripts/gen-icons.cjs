const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'public/icons/icon.svg'), 'utf8')
// iOS applies its own corner mask and fills transparent pixels with black,
// so the apple-touch-icon must be full-bleed (no rounded corners).
const fullBleed = svg.replace(/<rect width="512" height="512" rx="\d+"/, '<rect width="512" height="512"')
const out = [
  ['public/icons/icon-192.png', 192, svg],
  ['public/icons/icon-512.png', 512, svg],
  ['public/apple-touch-icon.png', 180, fullBleed],
]

;(async () => {
  for (const [rel, size, src] of out) {
    await sharp(Buffer.from(src), { density: 144 }).resize(size, size).png().toFile(path.join(root, rel))
    console.log('wrote', rel, size)
  }
})()
