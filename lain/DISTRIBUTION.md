# LAIN Distribution Plan (macOS + Linux)

This is the practical plan to ship LAIN so someone else can download/install it, plus how we’ll add Linux builds.

---

## macOS: how to ship to someone today

### 1) Bump version
- Edit `lain/package.json` → `"version": "x.y.z"`

### 2) Build the installer
From `lain/`:

```bash
npm ci
npm run build:mac
```

Artifacts land in `lain/release/`:
- `LAIN-x.y.z-arm64.dmg` (installer)
- `LAIN-x.y.z-arm64-mac.zip` (portable)

### 3) Share it
Best options:
- **GitHub Releases**: create a release and upload the `.dmg` + `.zip`
- **Direct file share**: send the `.dmg`

### 4) What the recipient does
1. Open the `.dmg`
2. Drag **LAIN.app** to **Applications**
3. Launch from Applications

If macOS blocks it (Gatekeeper):
- System Settings → Privacy & Security → **Open Anyway**

### 5) “No scary warning” (real distribution)
To avoid Gatekeeper warnings reliably, you need:
- Apple Developer ID Application certificate
- Notarization (Apple notary service)
- Stapling the notarization ticket

High-level steps:
1. Build signed app with `electron-builder` using your Developer ID
2. Notarize via `notarytool`
3. Staple ticket to the `.app` / `.dmg`

Once notarized, other Macs install normally without “developer can’t be verified” / “damaged” dialogs.

---

## Linux: how we’ll add it

### Target formats
We’ll ship:
- **AppImage** (portable, works on most distros)
- **.deb** (Debian/Ubuntu)

### Recommended build approach (CI)
Linux builds are easiest and most reliable on Linux itself because native modules (like `node-pty`, `better-sqlite3`) compile/pack correctly.

Plan:
1. Add a **GitHub Actions** workflow that runs on `ubuntu-latest`
2. Install deps (`npm ci`)
3. Run `npm run build:linux`
4. Upload artifacts from `lain/release/` to GitHub Actions + GitHub Releases

### Local Linux build (developer machine)
On a Linux machine:

```bash
cd lain
npm ci
npm run build:linux
```

Artifacts will land in `lain/release/` (names vary by builder config):
- `LAIN-x.y.z.AppImage`
- `lain_x.y.z_amd64.deb`

### Notes for Linux users
- AppImage requires executable bit:

```bash
chmod +x LAIN-x.y.z.AppImage
./LAIN-x.y.z.AppImage
```

---

## Release checklist (every time)
- Update `version` in `package.json`
- Run build(s): `npm run build:mac` and/or `npm run build:linux`
- Smoke test the packaged app
- Create GitHub Release and upload artifacts from `lain/release/`

