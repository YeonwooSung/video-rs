# Video RS

[English](README.md) | 한국어

**Tauri v2**(Rust)와 **Next.js 16**(정적보내기)으로 만든 데스크톱 영상 도구입니다. FFmpeg와 FFprobe는 사이드카로 실행합니다. 파일은 이 기기에만 있고 서버로 올라가지 않습니다.

UI 기본 언어는 한국어입니다. 사이드바 언어 버튼으로 English로 바꿀 수 있습니다. 테마는 시스템을 따르거나 밝음/어둠을 고릅니다.

## 하는 일

홈(또는 아무 도구)에서 파일을 고르면 경로가 기억되고 `?file=`로 페이지 사이에 넘어갑니다. 도구마다 같은 클립을 다시 고를 필요가 없습니다.

변환·추출 작업은 진행률을 보여주고 취소할 수 있으며 **작업** 페이지에 기록됩니다. 완료 토스트의 **폴더에서 보기**는 Finder, Explorer, 파일 관리자에서 결과 파일을 엽니다.

| 구분 | 도구 | 설명 |
|------|------|------|
| 살펴보기 | 분석 | 컨테이너, 길이, 비트레이트, 크기, 모든 스트림(코덱, FPS, 해상도, 언어, 제목) |
| 변환 | 변환 | 영상/오디오 다시 인코딩(소프트웨어 또는 하드웨어). 자막은 복사, 입히기, 빼기. 외부 `.srt`/`.ass` 입히기 가능 |
| 변환 | 합치기 | 여러 파일에서 고른 영상·오디오·자막 스트림을 하나로. 텍스트 자막은 출력 컨테이너에 맞게 변환(예: MP4의 `mov_text`) |
| 변환 | 유튜브 | 공개 watch/shorts/재생목록 URL을 yt-dlp로 저장 (1080/720/최고). 순차 받기. 로그인 없음 |
| 변환 | 추출 | 오디오(MP3, AAC, FLAC, WAV, Opus) 또는 자막(SRT, ASS, VTT) |
| 변환 | GIF | 구간의 팔레트 GIF (기본 10fps, 너비 480px) |
| 편집 | 자르기 | `[시작, 끝)` 구간. 빠른 스트림 복사 또는 프레임 단위 재인코딩 |
| 편집 | 클립 | 재생하며 시작/끝을 찍고, 구간마다 별도 파일로 보내기 |
| 편집 | 이어붙이기 | 목록 순서로 클립을 이음 (코덱이 같으면 복사, 아니면 다시 인코딩) |
| 편집 | 크롭 | 첫 프레임에서 사각형을 드래그(핸들 8개로 크기 조절)하거나 `W×H`, `X,Y`를 입력. 오디오는 복사 |
| 편집 | 크기 변경 | 프리셋 또는 직접 지정. 높이 `-2`는 비율 유지 |
| 편집 | 회전 / 뒤집기 | 90° / 180° / 270°와 좌우·상하 반전 |
| 편집 | 배속 | 더 빠르거나 느리게 보내기 (`setpts` + `atempo` 체인). UI 범위 0.25×–4× |
| 편집 | 페이드 | 검정에서 들어오거나 검정으로 나가기 (오디오 페이드 선택) |
| 편집 | 볼륨 | dB 게인(−48~+48) 또는 EBU R128 loudnorm. 영상은 스트림 복사 |
| 편집 | 워터마크 | PNG/JPEG 로고 또는 텍스트를 모서리/가운데에 입히기 |
| 앱 | 뷰어 | 로컬 재생, 배속, ±5초 / ±1프레임, 초 입력, 단축키, 스냅샷 |
| 앱 | 타임라인 | `/timeline` 멀티트랙 NLE. Phase 2 프로그램 모니터는 세션 프록시를 재생하고 플레이헤드가 프록시를 seek합니다. 보내기는 전체 해상도 |
| 앱 | 작업 | 이 기기의 최근 50건 (상태, 출력 경로, 폴더에서 보기, 다시 실행) |

## 일반적인 사용

1. 아래처럼 의존성과 사이드카를 설치한 뒤 `npm run tauri:dev`를 실행합니다.
2. **홈**에서 영상을 엽니다. 환경 카드에 FFmpeg/FFprobe와 하드웨어 인코더 유무가 나옵니다.
3. 사이드바나 홈 카드에서 도구를 엽니다. 입력은 채워져 있고, 출력은 원본 옆에 제안됩니다 (`clip_crop.mp4` 등).
4. 작업을 실행합니다. 필요하면 취소합니다. **폴더에서 보기** 또는 작업 페이지에서 파일을 찾습니다.
5. 작업의 **다시 실행**은 같은 명령을 새 `job_id`로 다시 돌립니다 (절대 경로 — 파일을 옮기면 실패합니다).

### 뷰어 단축키

| 키 | 동작 |
|----|------|
| 스페이스 | 재생 / 일시정지 |
| ← / → | ±5초 (Shift: ±1초) |
| `,` / `.` | 이전 / 다음 프레임 |

## 작업과 진행률

- 실행마다 `job_id`가 붙습니다. 진행 이벤트(`ffmpeg-progress`)에 id가 있어 도구 두 개가 동시에 돌아도 막대가 섞이지 않습니다.
- 취소는 해당 FFmpeg 자식 프로세스를 종료합니다. 사전 분석(프로브) 중 취소도 인코딩 전에 멈춥니다.
- 기록은 `localStorage`(`video-rs:jobs`)에만 있습니다. 서버로 보내지 않습니다. 작업 페이지에서 지울 수 있습니다.
- 다시 실행은 재생(replay) 데이터가 있어야 합니다. 지금 도구는 모두 저장합니다. 예전 기록은 다시 실행할 수 없습니다.

## 하드웨어 인코더

환경 검사는 번들 또는 PATH의 FFmpeg가 실제로 가진 인코더만 보여 줍니다. 보통은 다음과 같습니다.

- **VideoToolbox** (macOS) — `h264_videotoolbox`, `hevc_videotoolbox`
- **NVENC** (NVIDIA) — `h264_nvenc`, `hevc_nvenc`
- **QSV** (Intel) — `h264_qsv`, `hevc_qsv`

하드웨어 인코딩이 실행 중 실패하면 소프트웨어 인코더(`libx264` / `libx265` / `libvpx-vp9` / `prores_ks`)로 다시 시도하고 진행 메시지를 남깁니다. VideoToolbox는 `-allow_sw 1`을 그대로 둡니다.

품질 슬라이더는 인코더에 맞는 플래그로 바뀝니다. 소프트웨어는 CRF, VideoToolbox는 `-q:v`, NVENC는 `-cq`, QSV는 `-global_quality`입니다.

## 필요 환경

- **Node.js** 20+
- **Rust** stable (MSRV 1.77.2)
- 기기의 **FFmpeg**와 **FFprobe** (Homebrew, apt, winget, 또는 정적 빌드)

### FFmpeg 설치

```bash
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg

# Windows (winget)
winget install Gyan.FFmpeg
```

## 설치

```bash
git clone https://github.com/YeonwooSung/video-rs.git
cd video-rs
npm install
npm run setup:sidecars
```

macOS는 Xcode 명령줄 도구가 필요합니다 (`xcode-select --install`). `cargo`가 없으면 [rustup](https://rustup.rs/)으로 Rust를 설치하세요.

`setup:sidecars`는 PATH, Homebrew, 흔한 Windows 경로에서 바이너리를 찾아 Tauri 이름으로 만듭니다 (Unix는 심볼릭 링크, Windows는 복사).

| 플랫폼 | 사이드카 예 |
|--------|-------------|
| macOS ARM64 | `src-tauri/binaries/ffmpeg-aarch64-apple-darwin` |
| macOS x86_64 | `src-tauri/binaries/ffmpeg-x86_64-apple-darwin` |
| Linux x86_64 | `src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu` |
| Linux ARM64 | `src-tauri/binaries/ffmpeg-aarch64-unknown-linux-gnu` |
| Windows x86_64 | `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` |
| Windows ARM64 | `src-tauri/binaries/ffmpeg-aarch64-pc-windows-msvc.exe` |

`src-tauri/binaries/`는 git에 넣지 않습니다 (기기마다 다름). 실행 시 사이드카를 먼저 쓰고, 없으면 `PATH`를 씁니다. 홈의 **환경** 카드에 어느 쪽을 썼는지 나옵니다.

유튜브 받기는 선택입니다. PATH에 `yt-dlp`를 두면 됩니다 (`brew install yt-dlp` 등). 릴리스 번들에 yt-dlp는 넣지 않습니다.

## 개발, 빌드, 실행

FFmpeg·파일·유튜브와 붙는 도구는 **데스크톱 앱**에서 쓰세요. 브라우저 탭만으로는 부족합니다.

### 개발 (`tauri:dev`)

이 기기에서 매일 쓰는 흐름입니다.

```bash
npm install                 # 클론 후 한 번, lockfile이 바뀌면 다시
npm run setup:sidecars      # 한 번, 또는 FFmpeg를 다시 설치한 뒤
npm run tauri:dev
```

Next.js와 Tauri 창이 같이 뜹니다. Rust와 UI는 핫 리로드됩니다. 첫 실행은 Rust 크레이트를 컴파일해서 느리고, 그다음은 빠릅니다.

디버그 빌드는 타임라인 보내기를 **Pro**로 봅니다 (라이선스 파일 없음). 무료 게이트를 보려면:

```bash
VIDEO_RS_FORCE_TIER=free npm run tauri:dev
```

Apple Developer 계정은 **필요 없습니다.**

### 프론트만 (도구 확인용 아님)

```bash
npm run dev
```

`http://localhost:3000`이 열립니다. 레이아웃과 문구는 보이지만, 파일 열기·분석·인코딩·받기·라이선스 같은 Tauri `invoke`는 **실패**합니다. CSS/마크업 확인할 때만 쓰세요.

```bash
npm run build     # Tauri가 넣는 정적보내기 (out/)
npm run lint
```

### 제품 빌드 (`tauri:build`)

이 OS/아키텍처용 설치 파일입니다. 평소 사이드카 설정 후:

```bash
npm run setup:sidecars
npm run tauri:build
```

다른 기기용 이식 가능한 설치 파일 (대상에 Homebrew/apt FFmpeg가 없어도 됨):

```bash
npm run setup:sidecars:release    # 또는: npm run setup:sidecars -- --release
npm run tauri:build
```

`--release`는 `scripts/sidecar-lock.json`에 핀된 GPL 정적 FFmpeg/FFprobe를 받아 일반 파일로 씁니다 (Homebrew 심링크 아님). 번들은 수십–200MB+입니다. [docs/plan-static-ffmpeg.md](docs/plan-static-ffmpeg.md)를 보세요.

산출물 위치 (`src-tauri/tauri.conf.json`의 버전):

| OS | 산출물 |
|----|--------|
| macOS | `src-tauri/target/release/bundle/macos/video-rs.app` 및 `…/dmg/video-rs_*_<arch>.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/` 및 `…/nsis/` |
| Linux | `src-tauri/target/release/bundle/deb/` / `appimage/` / `rpm/` |

### 빌드한 앱 실행

- **macOS:** `video-rs.app`을 열거나 DMG를 마운트해 응용 프로그램으로 옮깁니다. 로컬 빌드는 **ad-hoc 서명**이라 빌드한 Mac에서만 바로 열립니다. 다른 Mac은 Gatekeeper가 막습니다. 나눠 주려면 Developer ID와 공증이 필요합니다 ([docs/signing.kr.md](docs/signing.kr.md)). **로컬 빌드·실행에는 Apple Developer 멤버십이 필요 없습니다.**
- **Windows / Linux:** 위 폴더의 설치 파일 또는 AppImage를 실행합니다.

라이선스 파일이 없는 릴리스 빌드는 **무료**입니다. 툴박스와 유튜브는 되고, 타임라인 보내기·프록시는 Pro 파일이 필요합니다.

### 테스트

```bash
npm run test:unit     # src-tauri의 cargo test (FFmpeg 불필요)
npm run test:smoke    # VIDEO_RS_SMOKE=1, PATH에 ffmpeg 필요
```

### 명령 요약

| 명령 | 설명 |
|------|------|
| `npm run tauri:dev` | **개발:** 데스크톱 앱 (Next.js + Rust) |
| `npm run tauri:build` | **빌드:** 이 기기용 `.app` / 설치 파일 |
| `npm run setup:sidecars` | 개발용 FFmpeg/FFprobe 연결 또는 복사 |
| `npm run setup:sidecars:release` | 이식 가능한 번들용 정적 FFmpeg |
| `npm run dev` | Next.js만 — IPC 없음, 도구 동작 안 함 |
| `npm run build` | `out/`으로 정적보내기 |
| `npm run test:unit` | Rust 단위 테스트 |
| `npm run test:smoke` | 실제 파일 스모크 테스트 |
| `npm run lint` | ESLint |

## 디렉터리

```
video-rs/
├── src/                          # Next.js App Router (정적보내기)
│   ├── app/                      # 페이지: 홈, 분석, 추출, 변환,
│   │                             # 뷰어, 자르기, 클립, 이어붙이기, 크롭,
│   │                             # 크기 변경, 회전, 배속, GIF,
│   │                             # 페이드, 볼륨, 워터마크, 작업
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── i18n/                 # 언어 전환
│   │   ├── theme/                # next-themes 제공자 + 토글
│   │   ├── job/JobProgress.tsx
│   │   ├── media/                # 크롭 핸들, 스트림 선택
│   │   └── video-player/         # video.js (SSR 안전 동적 import)
│   ├── hooks/                    # 진행률, 작업, 기억된 파일
│   └── lib/
│       ├── i18n.tsx              # 한/영 문구
│       ├── jobHistory.ts         # localStorage 기록
│       ├── jobReplay.ts          # 저장된 명령 다시 실행
│       └── tauri/                # invoke() 래퍼
├── src-tauri/                    # Tauri v2 + Rust
│   ├── src/commands/             # IPC: 인자는 snake_case
│   ├── src/services/             # FFmpeg 빌더, 작업, 사이드카
│   └── binaries/                 # ffmpeg-<트리플> (커밋하지 않음)
├── scripts/setup-sidecars.js
└── docs/
    ├── spec_v0.1.0.md
    └── TODO.md
```

프론트는 `output: "export"`라 런타임 Node 서버가 없습니다. Tauri 명령 인자는 **snake_case**입니다 (`input_path`, `job_id`). 변환/합치기의 중첩 options도 snake_case 필드입니다.

## 테스트와 CI

- Rust 테스트는 명령 빌더(크롭, 자르기, mux 맵, GIF, 배속, 볼륨, 페이드, 워터마크, 진행률 파싱, 인코더 매핑)를 다룹니다.
- GitHub Actions (`.github/workflows/ci.yml`)는 Ubuntu, Windows, macOS에서 다음을 실행합니다.
  - `src-tauri`에서 `cargo test`
  - `npm ci` + `npm run build`
  - FFmpeg 설치 후 `setup:sidecars`, 사이드카 파일 존재 확인

GUI나 실제 파일 E2E는 아직 없습니다. 브라우저의 `npm run dev`는 Tauri를 호출하지 못합니다. 도구를 쓰려면 `tauri:dev`를 쓰세요.

## 한계

- 사이드카 바이너리는 git에 없습니다. 기기(및 CI)마다 `setup:sidecars`가 필요합니다.
- loudnorm은 한 패스입니다.
- 페이드 아웃은 길이를 읽을 수 있어야 합니다.
- 이어붙이기 스트림 복사는 코덱이 같아야 합니다. 아니면 복사를 끄고 다시 인코딩하세요.
- 긴 GIF 구간은 느리고 파일이 커질 수 있습니다.
- 텍스트 워터마크는 시스템 글꼴을 찾습니다. 글꼴이 없으면 FFmpeg가 실패합니다.
- 다시 실행은 절대 경로를 저장합니다.
- 배속 UI는 0.25×–4×이고, Rust 명령은 직접 호출하면 0.125×–8×까지 받습니다.
- 데스크톱 서명/공증은 Apple Developer ID가 필요합니다 ([docs/signing.kr.md](docs/signing.kr.md)). 로컬 빌드는 ad-hoc 서명입니다.
- Homebrew로 연결한 FFmpeg 사이드카는 빌드한 Mac에서만 동작합니다. 배포용 설치 파일에는 정적 FFmpeg가 필요합니다.

## 문서

- [명세](docs/spec_v0.1.0.md) — 구조, IPC, FFmpeg 플래그
- [TODO](docs/TODO.md) — 구현된 항목 목록
- [서명과 공증](docs/signing.kr.md) — Developer ID, 공증, CI 시크릿
- [E2E / 실제 파일 스모크 계획](docs/plan-e2e.md) — `VIDEO_RS_SMOKE=1` (아직 미구현)
- [이식 가능한 정적 FFmpeg 계획](docs/plan-static-ffmpeg.md) — 릴리스 사이드카 (아직 미구현)
- [배포·과금 계획](docs/plan-business.md) — 유료 데스크톱 먼저, 업로드 SaaS 없음
- [English README](README.md)

## 라이선스

라이선스 파일은 없습니다. 소유자가 추가하기 전에는 private로 보면 됩니다.
