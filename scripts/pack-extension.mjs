import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const extDir = path.join(root, 'extension')
const outZip = path.join(root, 'public', 'makguard-extension.zip')

mkdirSync(path.join(root, 'public'), { recursive: true })
if (existsSync(outZip)) rmSync(outZip)

if (process.platform === 'win32') {
  const extGlob = path.join(extDir, '*')
  execSync(
    `powershell -NoProfile -Command "Compress-Archive -Path '${extGlob}' -DestinationPath '${outZip}' -Force"`,
    { stdio: 'inherit' }
  )
} else {
  execSync(`cd "${extDir}" && zip -r "${outZip}" . -x "*.DS_Store"`, { stdio: 'inherit' })
}

console.log('Packed extension to public/makguard-extension.zip')
