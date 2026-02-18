# Release

## Local build
- Install deps: `pnpm install`
- Build installers: `pnpm -w dist`
- Output:
  - macOS DMG: `apps/main/dist-electron/*.dmg`
  - Windows NSIS: `apps/main/dist-electron/*.exe`

## CI release (GitHub)
1) Bump versions in `apps/main/package.json` and `apps/renderer/package.json`.
2) Commit and push.
3) Tag and push:
   - `git tag v0.1.0`
   - `git push origin v0.1.0`
4) GitHub Actions builds and publishes installers to the GitHub Release.
