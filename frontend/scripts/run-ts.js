// Runs a .ts file directly via sucrase's require hook (already a project
// dependency — no ts-node/tsx needed), with tsconfig.json's `@/* -> ./*`
// path alias patched into Node's own module resolution first (sucrase only
// strips types; it does not resolve path aliases on its own).
//
// Usage: node scripts/run-ts.js <path-to-ts-file>
const path = require('path')
const Module = require('module')

const FRONTEND_ROOT = path.resolve(__dirname, '..')
const originalResolve = Module._resolveFilename
Module._resolveFilename = function (request, ...rest) {
  if (request.startsWith('@/')) {
    request = path.join(FRONTEND_ROOT, request.slice(2))
  }
  return originalResolve.call(this, request, ...rest)
}

require('sucrase/register')
const mod = require(path.resolve(process.argv[2]))
// Convention: a script meant to be run this way exports `main()` explicitly,
// rather than relying on a require.main/argv[1] check that a test importing
// the same module for its pure helpers could accidentally also trigger.
if (typeof mod.main === 'function') mod.main()
