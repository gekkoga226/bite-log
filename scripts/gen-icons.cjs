const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const svg = fs.readFileSync(path.join(root, 'public/icons/icon.svg'))
const out = [
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
  ['public/apple-touch-icon.png', 180],
]

;(async () => {
  for (const [rel, size] of out) {
    await sharp(svg).resize(size, size).png().toFile(path.join(root, rel))
    console.log('wrote', rel, size)
  }
})()
