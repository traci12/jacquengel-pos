// Makes the app available only to visitors in the allowed countries.
//
// Firebase Hosting "i18n rewrites" pick content by the visitor's country (from
// their IP address). The real app is moved to dist/localized/ALL_<cc>/ for each
// allowed country; everyone else gets the small "not available" page left in
// dist/. To turn this off, remove this script from the "build" step in
// package.json and the "i18n" block from firebase.json.
import { cpSync, mkdirSync, readdirSync, renameSync, rmSync, writeFileSync, copyFileSync } from 'node:fs'
import { join } from 'node:path'

const ALLOWED = ['ph'] // ISO country codes, lowercase
const dist = 'dist'
const appDir = join(dist, `_app`)

// 1. Move the built app aside.
rmSync(appDir, { recursive: true, force: true })
mkdirSync(appDir)
for (const f of readdirSync(dist)) if (f !== '_app') renameSync(join(dist, f), join(appDir, f))

// 1b. Country folders don't apply to rewrites, so pages other than "/" need
//     a real file. /auth/action (password reset links) gets a copy of the app.
mkdirSync(join(appDir, 'auth'), { recursive: true })
copyFileSync(join(appDir, 'index.html'), join(appDir, 'auth', 'action.html'))

// 2. Put a copy of the app in each allowed country's folder.
for (const cc of ALLOWED) cpSync(appDir, join(dist, 'localized', `ALL_${cc}`), { recursive: true })

// 3. Everyone else: a small page saying the app isn't available.
copyFileSync(join(appDir, 'logo-192.png'), join(dist, 'logo-192.png'))
copyFileSync(join(appDir, 'favicon.png'), join(dist, 'favicon.png'))
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<link rel="icon" type="image/png" href="/favicon.png" />
<title>JacqueNgel POS</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f6f4; color: #2c2723;
         font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 22rem; padding: 2rem 1.5rem; text-align: center; }
  img { width: 72px; height: 72px; }
  h1 { font-size: 1.25rem; margin: 1rem 0 .5rem; }
  p { margin: 0; color: #2c2723a6; line-height: 1.5; }
</style>
</head>
<body>
<main>
  <img src="/logo-192.png" alt="JacqueNgel" />
  <h1>Not available in your region</h1>
  <p>JacqueNgel POS can only be used in the Philippines.</p>
</main>
</body>
</html>
`
writeFileSync(join(dist, 'index.html'), page)
writeFileSync(join(dist, '404.html'), page)
rmSync(appDir, { recursive: true, force: true })
console.log(`geo-restrict: app limited to ${ALLOWED.join(', ').toUpperCase()}`)
