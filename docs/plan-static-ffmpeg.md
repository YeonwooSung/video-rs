# Video RS — 이식 가능한 정적 FFmpeg 사이드카 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **구현 전에 아래 “오너 결정”을 확인할 것.** 라이선스와 macOS 바이너리 출처가 잠기지 않으면 릴리스 경로를 구현하지 않는다.

**Goal:** `tauri:build` 산출물이 빌드 Mac의 Homebrew dylib 없이 다른 기기에서 동작하도록, 릴리스 전용으로 **핀된 GPL 정적** ffmpeg/ffprobe를 `src-tauri/binaries/`에 실제 파일로 넣는다. 일상 `tauri:dev`는 지금처럼 PATH/Homebrew 심링크를 유지한다.

**Architecture:** `scripts/setup-sidecars.js`에 `--release` 분기를 추가한다. 기본 호출은 현재 동작(로컬 바이너리 심링크/복사). `--release`는 `scripts/sidecar-lock.json`의 url/sha256을 받아 캐시에 풀고, Tauri triple 이름으로 **실파일**을 쓴다. 런타임 `sidecar.rs`의 sidecar-then-PATH는 바꾸지 않는다.

**Tech Stack:** Node (`scripts/setup-sidecars.js`), `scripts/sidecar-lock.json`, BtbN FFmpeg-Builds **gpl static**, macOS는 nonfree가 아닌 것이 **확인된** 정적 빌드만, GitHub Actions cache, `otool`/`ldd`/`-version` 검증.

**Spec:** 이 문서가 구현 명세다. 앱 동작은 [spec_v0.1.0.md](./spec_v0.1.0.md)를 따른다. 서명/공증은 [signing.md](./signing.md)의 “Homebrew FFmpeg is not portable”을 이 작업이 해소한다. 저장소 전체 `LICENSE`는 **남은 작업 4번**이며 여기서 만들지 않는다.

## Global Constraints

- Next.js 16 static export + Tauri v2. 사이드카 이름·IPC·`externalBin`을 바꾸지 않는다.
- 바이너리를 git에 넣지 않는다. `src-tauri/.gitignore`의 `/binaries/`는 유지한다.
- `--enable-nonfree` / fdk-aac / openssl-nonfree / DeckLink가 켜진 빌드는 **거절**한다.
- `lgpl-shared`와 BtbN `nonfree` 변형은 쓰지 않는다. 앱은 `libx264`가 필수다.
- 기본 `npm run setup:sidecars`와 `tauri:dev`는 Homebrew/PATH 워크플로를 유지한다.
- 정적 GPL ffmpeg를 배포하는 것은 라이선스 결정이다. 오너가 수락하기 전에 릴리스 경로를 켜지 않는다.
- 하드웨어 인코더(VideoToolbox / NVENC / QSV)는 detect-and-fallback이다. 정적 빌드에 없어도 소프트웨어 경로가 있으면 성공이다.

---

현재 `setup:sidecars`는 Homebrew/PATH ffmpeg를 `src-tauri/binaries/ffmpeg-<triple>`로 **심링크**한다. `tauri:build`가 그 파일을 `.app`에 복사해도 `otool -L`은 `/opt/homebrew/Cellar/ffmpeg/…`를 가리킨다. 앱 ~15MB / DMG ~5.3MB는 **빌드한 Mac에서만** 동작한다. 공증도 서명되지 않은 Homebrew dylib 때문에 막힌다.

## 1. 목표 / 비목표

### 목표

- 릴리스 번들의 ffmpeg/ffprobe가 **이식 가능**하다 (다른 Mac/PC에 Homebrew·apt ffmpeg가 없어도 실행).
- 일상 개발은 지금처럼 로컬 ffmpeg를 쓴다. 수백 MB 정적 바이너리를 매일 받지 않는다.
- 다운로드는 **핀**한다. floating `latest` URL을 런타임에 그대로 쓰지 않는다.
- 받은 바이너리가 앱이 쓰는 코덱/필터를 가지고, nonfree가 아닌지 검증한다.
- `release.yml`이 PATH/Homebrew가 아니라 정적 `--release` 사이드카로 아티팩트를 만든다.

### 비목표

- 모든 코덱을 직접 컴파일하는 만능 빌드 팜.
- `--enable-nonfree` / fdk-aac / 상용 AAC.
- 바이너리를 git에 커밋.
- Tauri sidecar 이름 변경 (`binaries/ffmpeg`, `binaries/ffprobe`, `ffmpeg-<triple>`).
- IPC / command surface 변경.
- 기본 `tauri:dev` Homebrew/PATH 제거.
- 저장소 루트 `LICENSE.txt` 작성 (남은 작업 4번).
- 하드웨어 인코더를 정적 빌드에 반드시 넣는 것.

## 2. 현재 vs 목표

| 항목 | 현재 | 목표 |
|------|------|------|
| `npm run setup:sidecars` | PATH/Homebrew 심링크(Unix) / 복사(Windows) | **그대로** (dev) |
| `npm run setup:sidecars -- --release` | 없음 | lockfile에서 정적 GPL을 받아 **실파일** 기록 |
| `src-tauri/binaries/` | gitignore, 머신별 링크 | gitignore 유지. release 모드에서는 심링크가 아닌 regular file |
| 런타임 | sidecar 실패 시 PATH (`sidecar.rs`) | **그대로**. `tauri:dev` PATH fallback 유지 |
| `tauri.conf.json` `externalBin` | `binaries/ffmpeg`, `binaries/ffprobe` | **그대로** |
| `release.yml` | `setup-ffmpeg@v3` + `setup:sidecars` | 정적 `--release`. 러너의 PATH ffmpeg를 번들에 넣지 않음 |
| `ci.yml` `sidecars` job | PATH ffmpeg 존재 확인 | 유지. 선택적으로 한 OS에서만 정적 다운로드 검증 |
| 번들 크기 | ~15MB app / ~5.3MB DMG | 정적 ffmpeg 때문에 **수십–수백 MB**. 아래 예상 크기 |
| 이식성 | 빌드 Mac 전용 | 대상 OS에서 Homebrew/apt ffmpeg 없이 실행 |

런타임은 이미 맞다.

```17:27:src-tauri/src/services/sidecar.rs
/// Try the bundled sidecar first, then fall back to a system binary on PATH.
/// This is how Windows/Linux machines without a bundled triple-named binary still work.
pub fn spawn_ffmpeg(app: &AppHandle, args: &[String]) -> Result<SpawnedSidecar, AppError> {
    spawn_tool(
        app,
        FFMPEG_SIDECAR,
        system_ffmpeg_name(),
        args,
        "FFmpeg",
    )
}
```

문제는 번들에 들어가는 **파일의 링크 방식**이지 spawn 순서가 아니다.

## 3. Dev vs release 흐름

잠근 결정:

1. **Dev** — `npm run setup:sidecars` / `tauri:dev`는 **현재 동작**. Homebrew·PATH를 찾아 Unix는 symlink, Windows는 copy. 정적 거대를 받지 않는다.
2. **Release / 이식** — `npm run setup:sidecars -- --release` (sibling 스크립트 금지. 같은 파일에 플래그). lockfile의 **핀된** 정적 빌드를 받아 `src-tauri/binaries/`에 실파일로 쓴다. Homebrew 심링크를 덮어쓴다.

```bash
# 매일 개발 (지금과 동일)
brew install ffmpeg          # 또는 apt / winget
npm run setup:sidecars
npm run tauri:dev

# 배포용 번들 (다른 기기에 줄 때)
npm run setup:sidecars -- --release
npm run tauri:build
```

`package.json`은 선택 별칭만 추가한다. 기본 스크립트 의미는 바꾸지 않는다.

```json
"setup:sidecars": "node scripts/setup-sidecars.js",
"setup:sidecars:release": "node scripts/setup-sidecars.js -- --release"
```

`--release` 동작:

1. `scripts/sidecar-lock.json`에서 **현재 호스트 triple** 항목을 읽는다.
2. 항목이 없거나 `status: "unavailable"`이면 **실패**하고 이유를 출력한다 (macOS 출처가 거절된 경우).
3. 캐시 디렉터리에 아카이브를 받는다. 이미 있고 sha256이 맞으면 재다운로드하지 않는다.
4. sha256이 틀리면 파일을 지우고 실패한다. “일단 풀어 보기”는 금지.
5. 압축을 풀고 lockfile이 가리키는 `ffmpeg` / `ffprobe` 경로를 꺼낸다.
6. 목적지에 기존 파일/심링크가 있으면 지운 뒤 **regular file로 복사**한다 (`symlinkSync` 금지).
7. 이식성 + `-version` + 코덱 스모크를 돌린다. 실패하면 목적지를 지우고 non-zero.
8. 호스트가 아닌 triple을 받으려면 `--triple <triple>` (선택, CI 크로스에는 쓰지 않음. 이 작업은 러너 네이티브만).

캐시 위치 (둘 다 gitignore):

- 로컬: `$XDG_CACHE_HOME/video-rs/sidecars/` 또는 macOS `~/Library/Caches/video-rs/sidecars/`
- CI: `${{ runner.temp }}/video-rs-sidecars` + `actions/cache` (key = `sidecars-${{ hashFiles('scripts/sidecar-lock.json') }}-${{ runner.os }}-${{ runner.arch }}`)

`--release`인데 lockfile 없이 PATH로 조용히 폴백하는 것은 **금지**. 릴리스가 다시 Homebrew를 묶게 된다.

## 4. 바이너리 출처

### 4.1 공통 규칙

- 변형: **GPL static**만. `lgpl`, `lgpl-shared`, `gpl-shared`, `nonfree`, `nonfree-shared` 금지.
- `ffmpeg -version` configuration에 `--enable-nonfree` / `--enable-libfdk-aac` / `openssl-nonfree`가 있으면 거절.
- git에 바이너리를 넣지 않는다. lockfile만 커밋한다.
- floating `.../latest/...` URL은 lockfile의 **기록용 주석**으로만 두고, 실제 `url`은 날짜가 찍힌 릴리스 에셋이어야 한다.

### 4.2 Windows / Linux — BtbN (잠금)

출처: [BtbN/FFmpeg-Builds](https://github.com/BtbN/FFmpeg-Builds).

| triple | 에셋 패턴 (gpl static) |
|--------|------------------------|
| `x86_64-pc-windows-msvc` | `ffmpeg-n9.0.*-win64-gpl-9.0.zip` |
| `aarch64-pc-windows-msvc` | `ffmpeg-n9.0.*-winarm64-gpl-9.0.zip` |
| `x86_64-unknown-linux-gnu` | `ffmpeg-n9.0.*-linux64-gpl.tar.xz` |
| `aarch64-unknown-linux-gnu` | `ffmpeg-n9.0.*-linuxarm64-gpl.tar.xz` |

구현 시 **특정 autobuild 태그**를 핀한다. 예: `autobuild-2026-08-30-13-12`의 `ffmpeg-n9.0.1-11-ge47273f4d9-win64-gpl-9.0.zip`. `ffmpeg-n9.0-latest-win64-gpl-9.0.zip`는 날짜가 바뀌므로 lock의 `url`로 쓰지 않는다.

아카이브 안 (BtbN 관례):

```
ffmpeg-n9.0.1-…-<os>-gpl[-9.0]/
  bin/ffmpeg[.exe]
  bin/ffprobe[.exe]
  bin/ffplay[.exe]    # 쓰지 않음. 복사하지 않음
```

BtbN `gpl`은 libx264 / libx265를 포함한다. `lgpl`은 둘 다 빼므로 앱과 맞지 않는다. `nonfree`는 fdk-aac를 더하므로 거절.

권장 핀: **release 브랜치 9.0** (master snapshot 아님). 구현자가 받을 때 `checksums.sha256`로 lockfile을 채운다.

### 4.3 macOS — 후보를 확인한 뒤에만 (잠금)

BtbN은 macOS를 만들지 않는다. 후보는 evermeet.cx / osxexperts / Martin Riedl뿐이다. **nonfree가 확인되지 않으면 쓰지 않는다.**

| 후보 | arch | 조사 결과 (2026-09) | 판정 |
|------|------|---------------------|------|
| [evermeet.cx](https://evermeet.cx/ffmpeg/) | **x86_64만** | configure에 `--enable-gpl --enable-version3`, **`--enable-nonfree` 없음**. fdk-aac/openssl 없음. ARM 제공 안 함 (명시) | x86_64는 **조건부 승인**: 받은 바이너리의 `-version`이 페이지와 같은지 재확인한 뒤에만 lock에 넣는다. ARM 불가 |
| [osxexperts.net](https://osxexperts.net/) | arm64 9.0 / Intel 8.0 | configure 미공개. “educational purposes only”. 소스 링크가 FFmpeg 6.1인데 파일명은 9.0 | **기본 거절**. 오너가 직접 받아 `-version`에 nonfree가 없음을 증명하기 전에는 lock에 넣지 않음 |
| [Martin Riedl](https://ffmpeg.martin-riedl.de/) | arm64 + x86_64 | 기본 스크립트 `SKIP_DECKLINK=YES`. DeckLink를 켤 때만 `--enable-nonfree`. OpenSSL은 `--enable-version3`(OpenSSL 3 / Apache 2 + GPLv3)이지 nonfree가 아님. fdk-aac 없음. 배포 URL은 `redirect/latest/...`로 **떠다님** | arm64 **1순위 후보**. 구현 전 `ffmpeg -version`에 `--enable-nonfree`가 없는지 **반드시** 확인. 있으면 거절. 핀은 redirect가 아니라 버전·날짜가 있는 URL + sha256 |

거절 시 폴백 (순서 고정):

1. 같은 규칙을 만족하는 **다른 공개 정적 빌드**를 찾아 lock에 적는다.
2. 없으면 CI/로컬에서 `--enable-gpl --disable-nonfree`로 **직접 정적 빌드**하는 별도 이슈. 그 스크립트는 이 v1의 필수 범위가 아니다.
3. 그것도 없으면 해당 macOS triple을 lock에서 `unavailable`로 두고 `--release`는 그 OS에서 실패한다. **Homebrew로 조용히 폴백하지 않는다.**

구현 Task 1이 하는 일: 후보를 받아 `-version` 한 줄을 이 문서 또는 PR에 붙이고, nonfree면 버리고 폴백을 고른다.

### 4.4 lockfile 스키마

경로: `scripts/sidecar-lock.json`.

```json
{
  "schemaVersion": 1,
  "ffmpegSeries": "n9.0",
  "note": "Pin dated assets only. Do not use floating /latest/ URLs as url.",
  "cacheHint": "Key CI cache by sha256 of this file.",
  "triples": {
    "x86_64-pc-windows-msvc": {
      "status": "pinned",
      "source": "btbn",
      "version": "n9.0.1-11-ge47273f4d9",
      "url": "https://github.com/BtbN/FFmpeg-Builds/releases/download/autobuild-YYYY-MM-DD-HH-MM/ffmpeg-n9.0.1-11-ge47273f4d9-win64-gpl-9.0.zip",
      "sha256": "<hex>",
      "archive": "zip",
      "ffmpeg": "ffmpeg-n9.0.1-11-ge47273f4d9-win64-gpl-9.0/bin/ffmpeg.exe",
      "ffprobe": "ffmpeg-n9.0.1-11-ge47273f4d9-win64-gpl-9.0/bin/ffprobe.exe"
    },
    "aarch64-apple-darwin": {
      "status": "unavailable",
      "source": null,
      "reason": "macOS ARM candidate not yet verified free of --enable-nonfree"
    }
  }
}
```

필드:

| 키 | 의미 |
|----|------|
| `status` | `pinned` 또는 `unavailable` |
| `source` | `btbn` / `evermeet` / `riedl` / `osxexperts` / `selfbuild` |
| `version` | 사람이 읽는 FFmpeg 버전 |
| `url` | 아카이브 직접 URL (dated) |
| `sha256` | 아카이브 전체 |
| `archive` | `zip` \| `tar.xz` \| `7z` (7z는 러너에 도구가 없으면 피한다. zip 우선) |
| `ffmpeg` / `ffprobe` | 아카이브 루트 기준 상대 경로 |
| `reason` | `unavailable`일 때 필수 |

evermeet은 ffmpeg/ffprobe를 **따로** 받는다. 그 triple은 객체를 둘로 나누거나 `artifacts: [{name, url, sha256, path}]` 배열을 쓴다. 스키마를 섞지 말 것 — Task 2에서 한 형태로 고정한다.

Windows ARM / Linux ARM은 BtbN에 있으므로 **같이 핀**한다. 지금 `release.yml`이 그 러너를 안 써도 lock에는 넣는다.

## 5. 앱이 실제로 쓰는 코덱 / 필터

`src-tauri/src/services/*.rs`와 프론트 선택지에서 확인.

### 필수 (정적 빌드에 없으면 `--release` 실패)

| 종류 | 이름 | 출처 |
|------|------|------|
| 비디오 인코더 | `libx264` | 기본값: trim re-encode, concat re-encode, crop, resize, transform, fade, speed, watermark, transcode |
| 비디오 인코더 | `libx265` | transcode/resize UI (`SOFTWARE_VIDEO_CODECS`) + HEVC HW 실패 시 fallback |
| 비디오 인코더 | `libvpx-vp9` | 같은 UI + vp9_qsv fallback |
| 오디오 인코더 | `aac` (네이티브) | volume, fade, speed, concat/trim re-encode, transcode 기본. **fdk-aac 아님** |
| 오디오 인코더 | `mp3` / `libmp3lame` | extract 기본 (`extract/page.tsx`). `-c:a mp3`가 lame에 매핑되면 통과 |
| 오디오 인코더 | `flac`, `pcm_s16le`, `libopus` | extract / transcode |
| 이미지 | `png` (및 jpeg 디코더) | `export_frame` → `out.png` |
| GIF | gif muxer + `palettegen` / `paletteuse` / `fps` / `split` | `gif.rs` |
| 필터 | `scale`, `crop` | resize, crop, gif |
| 필터 | `transpose`, `hflip`, `vflip` | `build_transform_filter` |
| 필터 | `volume`, `loudnorm` | `volume.rs` |
| 필터 | `fade`, `afade` | `fade.rs` |
| 필터 | `drawtext` | 텍스트 워터마크. `libfreetype` (+ 가능하면 fontconfig/harfbuzz) |
| 필터 | `overlay` | 이미지 워터마크, 비트맵 자막 burn-in |
| 필터 | `setpts`, `atempo` | `speed.rs` |
| 필터 | `subtitles` (libass) | 텍스트 자막 burn-in |
| 자막 인코더 | `srt`, `ass`, `mov_text`, `webvtt` | extract / mux / `subtitle_codec_for_output` |
| demuxer | `concat` (`-f concat -safe 0`) | `build_concat_args` |
| lavfi | `testsrc`, `sine` | smoke/픽스처 (CI·로컬 테스트). 릴리스 검증에도 1초짜리로 쓰면 좋다 |

### 선택 (없어도 됨)

| 이름 | 이유 |
|------|------|
| `h264_videotoolbox`, `hevc_videotoolbox`, `prores_videotoolbox` | `encoders.rs`가 `-encoders`에서 있을 때만 UI에 노출. 실패 시 software fallback |
| `h264_nvenc`, `hevc_nvenc`, `av1_nvenc`, `*_qsv` | 동일 |
| `prores_ks` | prores videotoolbox fallback. UI 기본 경로 아님 |
| `videotoolbox` / `cuda` / `qsv` hwaccel | 정적 빌드가 OS 프레임워크를 쓰면 보너스. 소프트웨어 decode로 충분 |

검증 커맨드 (`--release` 끝과 CI에서 동일):

```bash
FF=src-tauri/binaries/ffmpeg-<triple>
FP=src-tauri/binaries/ffprobe-<triple>

# 살아 있음
"$FF" -hide_banner -version
"$FP" -hide_banner -version

# nonfree 금지
! "$FF" -version | grep -E -- '--enable-nonfree|--enable-libfdk-aac'

# 필수 인코더 (한 줄에 토큰으로)
"$FF" -hide_banner -encoders | grep -E 'libx264|libx265|libvpx-vp9|aac |libmp3lame|^ .* mp3 |flac |pcm_s16le|libopus|png |gif '

# 필수 필터
"$FF" -hide_banner -filters | grep -E 'scale|crop|transpose|volume|loudnorm|afade|fade|drawtext|overlay|setpts|atempo|palettegen|paletteuse|subtitles'

# concat demuxer
"$FF" -hide_banner -demuxers | grep concat
```

`mp3` vs `libmp3lame`는 구현이 둘 중 하나만 있으면 통과로 친다. 앱은 `-c:a mp3`를 넘긴다.

## 6. 이식성 검증

다운로드·복사 직후, `tauri:build` 전후에 돌린다.

### macOS

```bash
# 심링크가 아님
test -f "$FF" && test ! -L "$FF"

# Homebrew / Cellar 금지. 시스템 라이브러리는 허용
otool -L "$FF" | tee /tmp/ffmpeg-otool.txt
! grep -E '/opt/homebrew|/usr/local/Cellar' /tmp/ffmpeg-otool.txt

# 허용 예: /usr/lib/libSystem.B.dylib, /System/Library/Frameworks/..., @rpath (자기 옆이면)
```

번들 안에서도 한 번 더:

```bash
APP=src-tauri/target/release/bundle/macos/video-rs.app
otool -L "$APP/Contents/MacOS/ffmpeg"
otool -L "$APP/Contents/MacOS/ffprobe"
"$APP/Contents/MacOS/ffmpeg" -version
```

### Linux

```bash
test -f "$FF" && test ! -L "$FF"
ldd "$FF" || true
# 배포판 libavcodec/libavformat/libx264 금지
! ldd "$FF" | grep -E 'libavcodec|libavformat|libavfilter|libx264|libx265'
# 이상적: "not a dynamic executable" 또는 libc/libm/libpthread/ld-linux만
```

BtbN linux gpl static은 보통 glibc에는 동적 링크한다 (RHEL 8 / glibc 2.28+). 그것은 허용. distro ffmpeg 패키지(.so)는 불허.

### Windows

```powershell
# 심링크/Homebrew 없음. ffmpeg.exe 옆에 추가 DLL이 없어야 함
Get-Command .\src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe
.\src-tauri\binaries\ffmpeg-x86_64-pc-windows-msvc.exe -version
# dumpbin /DEPENDENTS 또는 그냥 실행. vcruntime/ucrt 외 ffmpeg DLL이 옆에 필요하면 실패
```

BtbN win64 **gpl** (shared 아님)은 단일 exe여야 한다. `gpl-shared`를 받으면 DLL이 빠져 실패한다.

### 예상 번들 크기

지금: app ~15MB, DMG ~5.3MB (Homebrew **링크**만 복사되고 dylib은 빠짐).

정적 빌드 (2026-09 BtbN / evermeet 대략):

| 산출 | 대략 |
|------|------|
| BtbN win64 gpl zip (ffmpeg+ffprobe+ffplay) | ~160 MiB 압축 |
| BtbN linux64 gpl tar.xz | ~120 MiB 압축 |
| 꺼낸 ffmpeg+ffprobe만 (ffplay 제외) | 보통 **합계 80–200 MB** 비압축 |
| evermeet ffmpeg zip (Intel, 하나) | ~25 MB 압축 / ~80 MB 비압축. ffprobe 따로 |
| 그 결과 `.app` / DMG / NSIS | **수십–200+ MB**. 15MB로 돌아가지 않음 |

README/릴리스 노트에 크기 점프를 적는다. 크기 최적화를 위해 코덱을 직접 줄여 빌드하는 것은 이 계획의 범위 밖이다.

## 7. 라이선스

이 작업은 **라이선스 텍스트를 고르거나 `LICENSE`를 추가하지 않는다.** 그건 남은 작업 4번이다.

사실만 적는다:

- BtbN `gpl` 정적 바이너리(그리고 evermeet/Riedl의 `--enable-gpl` 빌드)는 **GPL** FFmpeg + libx264/libx265 등 GPL 라이브러리를 정적 링크한다.
- 그 바이너리를 앱에 넣어 **배포**하면, 배포본 전체가 GPL 의무를 질 수 있다 (대응하는 소스 제공, 고지, 같은 조건). 최종 해석은 변호사가 한다. 이 문서는 경고만 한다.
- `--enable-nonfree` 빌드는 재배포 자체가 막힐 수 있어, 여기서는 기술적으로 거절한다.
- 앱을 비공개·사내만 쓰고 설치 파일을 밖으로 안 주면 리스크가 다르다. **오너가 배포 여부를 정해야 한다.**
- 구현자가 AGPL/GPL/MIT 문구를 지어내 루트에 넣지 말 것.
- 정적 바이너리를 넣을 때 번들 안에 FFmpeg 고지(`COPYING`, 버전 문자열)를 같이 두는 것은 좋지만, 앱 라이선스를 대신하지 않는다. 넣으면 `src-tauri` 리소스나 `docs/third-party/ffmpeg` 정도가 적당하다. 필수는 오너 결정.

**게이트:** 오너가 “정적 GPL ffmpeg를 배포 아티팩트에 넣는 것을 수락한다”고 하기 전에는 `release.yml`을 `--release`로 바꾸지 않는다. 스크립트와 lockfile은 준비해도 된다.

## 8. CI / release.yml

### 현재

`.github/workflows/release.yml` (tag `v*`):

- macos / windows 각각 `FedericoCarboni/setup-ffmpeg@v3` → `npm run setup:sidecars` → `tauri:build`
- macos-latest Homebrew/액션 ffmpeg를 심링크하므로 **지금과 같은 이식 불가 아티팩트**가 나온다.

`.github/workflows/ci.yml` `sidecars` job:

- 3 OS에서 PATH ffmpeg로 `setup:sidecars` 후 `ffmpeg-*` / `ffprobe-*` **존재만** 확인.

### 목표

`release.yml` (필수):

```yaml
      # setup-ffmpeg@v3 를 릴리스 잡에서 제거한다.
      # 정적 바이너리가 번들에 들어가야 한다.
      - run: npm ci
      - uses: actions/cache@v4
        with:
          path: ${{ runner.temp }}/video-rs-sidecars
          key: sidecars-${{ hashFiles('scripts/sidecar-lock.json') }}-${{ runner.os }}-${{ runner.arch }}
      - name: Portable static sidecars
        env:
          VIDEO_RS_SIDECAR_CACHE: ${{ runner.temp }}/video-rs-sidecars
        run: npm run setup:sidecars -- --release
      - name: Assert not a Homebrew symlink
        if: runner.os == 'macOS'
        run: |
          bin=(src-tauri/binaries/ffmpeg-*)
          test -f "${bin[0]}" && test ! -L "${bin[0]}"
          otool -L "${bin[0]}" | tee /tmp/otool.txt
          ! grep -E '/opt/homebrew|/usr/local/Cellar' /tmp/otool.txt
      - run: npm run tauri:build
```

macOS lock 항목이 `unavailable`이면 이 잡은 **실패하는 것이 맞다.** Homebrew로 숨기지 않는다.

`ci.yml` `sidecars` job (유지):

- 지금처럼 `setup-ffmpeg@v3` + `setup:sidecars` + 파일 존재.
- 싸면 한 매트릭스(예: `ubuntu-latest`)에만 `setup:sidecars -- --release` + sha256 + `-version`을 추가한다. 3 OS 정적 다운로드는 필수 아님 (용량·시간).

`ci.yml`의 `rust` / `frontend`는 손대지 않는다.

## 9. 바꿀 파일

| 경로 | 역할 |
|------|------|
| `scripts/setup-sidecars.js` | `--release` 분기, 캐시, sha256, 실파일 복사, 검증 |
| `scripts/sidecar-lock.json` | **신규.** triple별 url/sha256 |
| `package.json` | 선택 스크립트 `setup:sidecars:release` |
| `.gitignore` (루트 또는 `src-tauri`) | 로컬 캐시를 레포 안에 둘 때만. 기본은 유저 캐시 |
| `.github/workflows/release.yml` | 정적 `--release`, macos에서 otool 단언 |
| `.github/workflows/ci.yml` | 선택: 한 OS 정적 검증 |
| `docs/signing.md` | “Homebrew FFmpeg is not portable”에 `--release` 절차를 한 단락 |
| `docs/signing.kr.md` | 같은 단락 (이미 한국어 파일이 있음) |
| `docs/spec_v0.1.0.md` §5 | 한 줄: 프로덕션은 정적 핀. README는 부모가 링크 |

**금지:** README 수정 (부모 작업). 루트 `LICENSE` 생성. `tauri.conf.json` `externalBin` 변경. `sidecar.rs` / `binary.rs` 이름 변경. `src-tauri/binaries/*` 커밋.

구현이 만져도 되는 런타임은 **검증용 로그만**. spawn 순서와 PATH fallback은 그대로.

## 10. 작업 순서

- [ ] **Task 0 — 오너 게이트 (코드 없음)**
  - 정적 GPL ffmpeg를 **배포 아티팩트에 넣는 것**을 수락하는가?
  - macOS ARM 출처: Riedl 검증 / 직접 빌드(후속) / 당분간 macOS `--release` 실패 허용?
  - 아니오라면 스크립트/lock만 준비하거나 작업을 멈춘다. `release.yml`은 바꾸지 않는다.

- [ ] **Task 1 — macOS 후보 검증 (다운로드만, 앱 코드 없음)**
  - Martin Riedl arm64 **release** zip을 받아 `ffmpeg -version` / `ffprobe -version`을 저장.
  - `--enable-nonfree` 또는 `libfdk`가 있으면 **거절**하고 폴백을 문서화.
  - evermeet x86_64 release zip도 같은 검사. ARM이 아님을 확인.
  - osxexperts는 오너가 요청하지 않으면 받지 않음.
  - 결과를 PR 본문 또는 이 문서 §4.3에 한 표로 남김.

- [ ] **Task 2 — `scripts/sidecar-lock.json`**
  - §4.4 스키마. BtbN 9.0 dated 에셋 + sha256 (win64, winarm64, linux64, linuxarm64).
  - macOS는 Task 1 결과에 따라 `pinned` 또는 `unavailable`.
  - floating `latest` URL을 `url`에 넣지 않음.

- [ ] **Task 3 — `setup-sidecars.js --release`**
  - 인자 파싱: `--release`, 선택 `--triple`, `VIDEO_RS_SIDECAR_CACHE`.
  - 기본 경로(플래그 없음)는 현재 `findBinary` + `linkOrCopy` **그대로**.
  - `--release`: lock 읽기 → 캐시 → sha256 → 압축 해제 → regular file 복사 → §5·§6 검증.
  - `unavailable` / 해시 불일치 / nonfree / Homebrew otool 흔적 → exit 1.
  - Windows는 `https` + unzip (Node 내장 또는 `powershell Expand-Archive`). Linux는 `tar`. zip을 우선해 7z 의존을 피함.

- [ ] **Task 4 — 로컬 검증 (구현 머신)**
  - 플래그 없이: 지금처럼 Homebrew 심링크, `tauri:dev` PATH fallback.
  - `--release` 후: `test ! -L`, `otool -L` (macOS) 또는 `ldd` (Linux).
  - `ffmpeg -version` / `ffprobe -version`.
  - 가능하면 `tauri:build` 후 번들 바이너리에도 같은 검사. 크기 기록.

- [ ] **Task 5 — `release.yml`**
  - Task 0이 yes일 때만.
  - `setup-ffmpeg@v3` 제거. cache + `setup:sidecars -- --release`.
  - macOS job에 Homebrew 심링크가 아님을 단언.
  - Windows job도 같은 `--release`.

- [ ] **Task 6 — `ci.yml` (최소)**
  - 기존 `sidecars` 존재 확인은 유지.
  - 선택: `ubuntu-latest` 한 잡에서 `--release` + `-version`.

- [ ] **Task 7 — 문서**
  - `docs/signing.md` / `signing.kr.md`에 `--release` 한 단락.
  - spec §5에 프로덕션=정적 핀 한 줄.
  - README는 부모가 링크. 여기서 수정하지 않음.

구현 중 금지: 바이너리 커밋, 기본 `setup:sidecars`가 네트워크를 타게 만들기, nonfree 에셋, sidecar 이름 변경, 루트 LICENSE 창작.

## 11. 성공 기준

1. `npm run setup:sidecars` (플래그 없음)는 오늘과 같이 로컬 ffmpeg를 심링크/복사하고, 네트워크가 없어도 성공한다.
2. `npm run tauri:dev`는 사이드카가 없거나 깨져도 PATH ffmpeg로 동작한다 (`sidecar.rs` 불변).
3. `--release`는 lockfile sha256과 일치하는 **regular file**을 쓰고, Homebrew 심링크를 남기지 않는다.
4. macOS 릴리스 바이너리의 `otool -L`에 `/opt/homebrew` 또는 `/usr/local/Cellar`가 없다.
5. Linux 릴리스 바이너리는 distro libav* 없이 뜬다 (glibc는 허용).
6. Windows 릴리스 exe는 옆에 ffmpeg DLL이 필요 없다.
7. 받은 ffmpeg/ffprobe가 `-version`에 성공하고 §5 필수 인코더/필터를 가진다. configuration에 `--enable-nonfree`가 없다.
8. `release.yml`이 `--release`를 쓰며, 성공 시 아티팩트가 빌드 러너 밖의 같은 OS에서 실행된다.
9. `src-tauri/binaries/`와 다운로드 캐시가 git에 없다.
10. 번들 크기 증가가 문서에 적혀 있다 (15MB로 유지된다고 쓰지 않음).

## 12. 범위 밖

- 모든 코덱을 직접 컴파일 / 최소 코덱 커스텀 FFmpeg.
- `--enable-nonfree`, fdk-aac, 상용 AAC.
- 바이너리 커밋, LFS.
- sidecar 이름·`externalBin`·IPC 변경.
- 기본 `tauri:dev`에서 Homebrew/PATH 제거.
- 루트 라이선스 파일 (남은 작업 4번).
- 하드웨어 인코더를 정적 빌드에 강제로 넣기.
- Linux AppImage 전용 rpath 재포장, Windows ARM 전용 릴리스 잡 (lock만 준비).
- Playwright / GUI E2E (`docs/plan-e2e.md`).

## 13. 오너가 답해야 하는 질문

구현자가 추측하지 말 것.

1. **라이선스 (차단)** — 정적 GPL ffmpeg가 들어 있는 `.app` / DMG / NSIS를 외부에 배포할 것인가? 수락하기 전에 `release.yml`을 바꾸지 않는다. 앱 전체 라이선스 문구는 이 작업에서 고르지 않는다.
2. **macOS ARM 출처 (차단에 가깝다)** — Riedl 빌드의 `-version`이 깨끗하면 그걸 핀할 것인가, 직접 빌드 이슈를 열 것인가, 당분간 macOS 이식 릴리스를 포기할 것인가?
3. **osxexperts** — “educational only” + 비공개 configure를 오너가 직접 검증하기 전에는 쓰지 않는다. 예외를 원하는가?
4. **FFmpeg 시리즈** — 이 문서는 BtbN **9.0 release**를 권한다. 7.1 LTS를 원하는가?
5. **Windows/Linux ARM** — lock에는 넣는다. `release.yml` 잡을 지금 추가할 것인가, 나중에 할 것인가?
6. **번들 크기** — 80–200MB+를 수용하는가? 수용하지 않으면 이 계획의 “공개 정적 GPL” 전제와 충돌한다 (커스텀 슬림 빌드는 범위 밖).
