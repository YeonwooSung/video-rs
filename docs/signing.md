# Signing and notarization

Local `npm run tauri:build` produces an **ad-hoc** signed `video-rs.app` and a DMG. That is enough to run on the build machine. Gatekeeper will block the app on other Macs until it is signed with a **Developer ID Application** certificate and **notarized**.

This machine currently has **no valid codesigning identity** (`security find-identity -v -p codesigning` is empty). The repo is wired so a later build signs and notarizes automatically once Apple credentials are available.

## What the last local build produced

| Artifact | Path |
|----------|------|
| App | `src-tauri/target/release/bundle/macos/video-rs.app` |
| DMG | `src-tauri/target/release/bundle/dmg/video-rs_0.1.0_aarch64.dmg` |

Verified on this Mac:

- App launches (process `Contents/MacOS/app`).
- Bundled `ffmpeg` / `ffprobe` respond to `-version`.
- Signature is **adhoc** (`TeamIdentifier=not set`). `spctl` rejects it.

### Homebrew FFmpeg is not portable

`setup:sidecars` currently **symlinks** Homebrew binaries. The bundle copies those binaries, but they still load dylibs from `/opt/homebrew/Cellar/ffmpeg/…`. That works here and fails on a Mac without the same Homebrew install. Notarization will also struggle with unsigned Homebrew libraries.

For a shippable installer, replace the sidecars with **statically linked** FFmpeg/FFprobe (or a self-contained relocatable build) before signing.

## macOS (Developer ID + notarization)

Needs an [Apple Developer Program](https://developer.apple.com/programs/) membership (~USD 99/year).

### 1. Change the bundle id

`tauri.conf.json` uses `com.videoapp.dev`. Register a unique id you control (for example `com.yourname.videors`) under Certificates, Identifiers & Profiles, then set `identifier` to that value.

### 2. Create a Developer ID Application certificate

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list) → **+** → **Developer ID Application**.
2. Download the `.cer` and open it to install it in **login** keychain.
3. Confirm:

```bash
security find-identity -v -p codesigning
```

You want a line like `Developer ID Application: Your Name (TEAMID)`.

### 3. Entitlements

`src-tauri/entitlements.plist` is already referenced from `bundle.macOS.entitlements`. Hardened Runtime is on. The file allows JIT (WKWebView) and disables library validation so the FFmpeg sidecar can load.

Do **not** turn on App Sandbox unless you are targeting the Mac App Store (that path needs extra file and sidecar entitlements).

### 4. Sign and notarize locally

Export an app-specific password at [appleid.apple.com](https://appleid.apple.com) (Sign-In and Security → App-Specific Passwords). Team ID is on the [membership](https://developer.apple.com/account) page.

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"
# optional if the Apple ID belongs to several teams:
# export APPLE_PROVIDER_SHORT_NAME="TEAMID"

npm run setup:sidecars
npm run tauri:build
```

Tauri signs the `.app` and DMG, submits notarization, and staples the ticket when `APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID` are set.

App Store Connect API key instead of Apple ID:

```bash
export APPLE_API_KEY="XXXXXXXXXX"
export APPLE_API_ISSUER="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export APPLE_API_KEY_PATH="$HOME/.appstoreconnect/private_keys/AuthKey_XXXXXXXXXX.p8"
```

### 5. Check the result

```bash
APP=src-tauri/target/release/bundle/macos/video-rs.app
codesign -dv --verbose=4 "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
spctl -a -vv "$APP"
# expected: accepted, source=Notarized Developer ID
```

## CI (GitHub Actions)

`.github/workflows/release.yml` builds on a tag (`v*`) and, on macOS, signs when these repository secrets exist:

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64 of the exported `.p12` (`openssl base64 -A -in cert.p12`) |
| `APPLE_CERTIFICATE_PASSWORD` | Password used when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | Exact `Developer ID Application: …` string |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | 10-character team id |

Export the `.p12` from Keychain Access (certificate + private key). Never commit the p12 or passwords.

## Windows Authenticode

`bundle.windows` already sets SHA-256 and a timestamp URL. For a signed `.msi`/NSIS installer set:

```bash
export TAURI_SIGNING_PRIVATE_KEY=...   # if using Tauri updater keys
# and/or
# tauri.conf.json > bundle.windows.certificateThumbprint
```

Or provide a custom `bundle.windows.signCommand`. A code-signing certificate from a public CA is required for SmartScreen.

## Linux

No Apple/Microsoft signature. Ship the AppImage/deb/rpm from `tauri:build` and optionally sign the package with your GPG key for the distro channel.
