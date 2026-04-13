import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

const version = process.argv[2]

if (!version) {
  console.error('Usage: pnpm update-v <version>  (e.g. pnpm update-v 1.0.0)')
  process.exit(1)
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error(`Invalid version "${version}" — must be X.Y.Z`)
  process.exit(1)
}

function updateJson(filePath, updater) {
  const content = JSON.parse(readFileSync(filePath, 'utf8'))
  updater(content)
  writeFileSync(filePath, JSON.stringify(content, null, 2) + '\n')
  console.log(`  updated ${filePath.replace(root, '.')}`)
}

function updateToml(filePath, oldVersion) {
  let content = readFileSync(filePath, 'utf8')
  const updated = content.replace(
    /^(version\s*=\s*)"[^"]+"/m,
    `$1"${version}"`
  )
  if (content === updated) {
    console.warn(`  warning: version not found in ${filePath.replace(root, '.')}`)
    return
  }
  writeFileSync(filePath, updated)
  console.log(`  updated ${filePath.replace(root, '.')}`)
}

console.log(`Bumping version to ${version}...\n`)

updateJson(resolve(root, 'package.json'), (pkg) => { pkg.version = version })
updateJson(resolve(root, 'src-tauri/tauri.conf.json'), (cfg) => { cfg.version = version })
updateToml(resolve(root, 'src-tauri/Cargo.toml'))

console.log('\nDone.')
