# 서명과 공증

로컬 `npm run tauri:build`는 **ad-hoc** 서명된 `video-rs.app`과 DMG를 만듭니다. 빌드한 Mac에서는 실행됩니다. 다른 Mac의 Gatekeeper는 **Developer ID Application** 인증서로 서명하고 **공증(notarize)** 하기 전에는 막을 수 있습니다.

이 저장소를 빌드한 기기에는 유효한 코드서명 인증서가 없습니다 (`security find-identity -v -p codesigning`이 비어 있음). Apple 자격 증명을 넣으면 다음 빌드부터 자동으로 서명·공증하도록 설정해 두었습니다.

## 최근 로컬 빌드

| 산출물 | 경로 |
|--------|------|
| 앱 | `src-tauri/target/release/bundle/macos/video-rs.app` |
| DMG | `src-tauri/target/release/bundle/dmg/video-rs_0.1.0_aarch64.dmg` |

이 Mac에서 확인한 내용:

- 앱이 실행됨 (`Contents/MacOS/app` 프로세스).
- 번들 `ffmpeg` / `ffprobe`가 `-version`에 응답함.
- 서명은 **adhoc** (`TeamIdentifier=not set`). `spctl`은 거부함.

### Homebrew FFmpeg는 들고 다닐 수 없음

`setup:sidecars`는 Homebrew 바이너리를 **심볼릭 링크**합니다. 번들에 그 바이너리가 복사되지만, dylib은 여전히 `/opt/homebrew/Cellar/ffmpeg/…`를 찾습니다. 같은 Homebrew가 있는 Mac에서만 동작하고, 공증도 서명되지 않은 Homebrew 라이브러리 때문에 어려울 수 있습니다.

배포용 설치 파일을 만들려면 서명 전에 **정적 링크** FFmpeg/FFprobe(또는 재배치 가능한 빌드)로 사이드카를 바꾸세요.

## macOS (Developer ID + 공증)

[Apple Developer Program](https://developer.apple.com/programs/) 멤버십이 필요합니다 (연간 약 USD 99).

### 1. 번들 ID 변경

`tauri.conf.json`의 `com.videoapp.dev`는 자리 표시자입니다. Certificates, Identifiers & Profiles에서 본인 소유의 ID(예: `com.yourname.videors`)를 등록한 뒤 `identifier`를 그 값으로 바꾸세요.

### 2. Developer ID Application 인증서

1. [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/certificates/list) → **+** → **Developer ID Application**.
2. `.cer`를 받아 **로그인** 키체인에 설치합니다.
3. 확인:

```bash
security find-identity -v -p codesigning
```

`Developer ID Application: 이름 (TEAMID)` 줄이 보여야 합니다.

### 3. Entitlements

`src-tauri/entitlements.plist`는 `bundle.macOS.entitlements`에 연결되어 있습니다. Hardened Runtime은 켜져 있습니다. WKWebView용 JIT와 FFmpeg 사이드카 로딩을 허용합니다.

Mac App Store가 아니면 App Sandbox를 켜지 마세요 (파일/사이드카 권한이 더 필요합니다).

### 4. 로컬에서 서명·공증

[appleid.apple.com](https://appleid.apple.com)에서 앱 전용 암호를 만듭니다. Team ID는 [멤버십](https://developer.apple.com/account) 페이지에 있습니다.

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="TEAMID"

npm run setup:sidecars
npm run tauri:build
```

`APPLE_ID` + `APPLE_PASSWORD` + `APPLE_TEAM_ID`가 있으면 Tauri가 `.app`과 DMG를 서명하고 공증을 제출한 뒤 티켓을 스테이플합니다.

### 5. 결과 확인

```bash
APP=src-tauri/target/release/bundle/macos/video-rs.app
codesign -dv --verbose=4 "$APP"
codesign --verify --deep --strict --verbose=2 "$APP"
spctl -a -vv "$APP"
# 기대: accepted, source=Notarized Developer ID
```

시크릿 목록과 Windows/Linux는 [영문 문서](signing.md)를 보세요.
