import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import pkg from './package.json'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    // Integer build number compared against v2_meta/app.{latestBuild,
    // minBuild} for the in-app update prompts. Bump `appBuild` in
    // package.json with every store release.
    __APP_BUILD__: JSON.stringify(pkg.appBuild ?? 0),
  },
})
