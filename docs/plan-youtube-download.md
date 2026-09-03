# Video RS — YouTube 받기 계획 (단일 URL → 재생목록)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Phase 2는 Phase 1 성공 기준을 만족한 뒤에만 구현한다.**

**Goal:** 공개 YouTube 영상 URL을 이 기기에 파일로 받는다. 1차는 **URL 하나 → 파일 하나**. 그다음 **재생목록·여러 URL을 순차로** 받는다. 받은 파일은 기존 분석·자르기·타임라인 도구로 넘긴다.

**Architecture:** **yt-dlp**를 FFmpeg와 같은 사이드카 모델로 붙인다 (번들 우선, 없으면 PATH). 영상+오디오 합치기는 이미 있는 FFmpeg 사이드카에 `--ffmpeg-location`으로 맡긴다. UI는 `/download` 한 페이지. 진행률·취소·Jobs는 `JobRegistry` / `useFfmpegJob`를 재사용한다 (이벤트 이름은 기존 `ffmpeg-progress`를 쓰거나 `job-progress` 별칭 하나 — 아래 Ruling). 기존 도구 IPC는 바꾸지 않는다.

**Tech Stack:** Tauri v2 `shell` sidecar, yt-dlp, 기존 FFmpeg, Next.js 16 static export, `useFfmpegJob`, i18n ko/en.

**Spec:** 이 문서가 구현 명세다. 앱의 기존 부분은 [spec_v0.1.0.md](./spec_v0.1.0.md)를 따른다.

## 잠근 제품 결정

대화에서 고정한 값이다. 구현 중 바꾸려면 이 절을 먼저 고친다.

| 결정 | 값 |
|------|-----|
| 1차 | 공개 **영상 URL 하나** → 파일 하나. 화질(최고 / 1080p / 720p), 저장 위치, 진행률·취소. |
| 2차 | **재생목록 또는 URL 여러 개**를 목록으로 보여 주고 **순차**로 받는다. |
| 사이트 | 1·2차 모두 **YouTube 호스트만**. 다른 추출기는 UI에서 거절한다. |
| 로그인·쿠키 | **하지 않는다.** 비공개·연령 제한·유료는 실패 메시지를 보여 준다. |
| 오디오만 | 1·2차 비목표. 백로그. |
| 기존 도구 | 그대로 둔다. `/download`는 변환 그룹의 새 페이지. |
| 받은 뒤 | `rememberFile` + 성공 토스트 **폴더에서 보기**. 뷰어/타임라인으로 가는 링크. |

이 기능은 **이 기기에 파일을 남기는 로컬 도구**다. DRM 우회, 쿠키 훔치기, 로그인 세션 추출은 구현하지 않는다.

---

## Global Constraints

- Next.js 16 static export + Tauri v2. 브라우저 `npm run dev`는 IPC가 없다.
- 인자는 **snake_case**. `Option<T>`는 IPC에서 `null`.
- 새 빌더는 `services/ffmpeg.rs`에 넣지 않는다. `services/ytdlp.rs` (+ `commands/download.rs`).
- `JobRegistry` / `cancel_job` / `useFfmpegJob`를 재사용한다. 두 번째 잡 레지스트리를 만들지 않는다.
- 기본 `cargo test`는 네트워크와 yt-dlp 없이 통과한다. 실제 YouTube 호출은 CI 기본 잡에 넣지 않는다.
- Playwright / 프론트 테스트 러너는 도입하지 않는다.
- 기존 도구 IPC 시그니처를 바꾸지 않는다.
- `setup:sidecars --release`의 FFmpeg 핀 로직을 깨지 않는다.

---

## 1. 목표 / 비목표

### Phase 1 목표

- URL을 붙여 넣고 **미리보기**(제목, 길이, 업로더, 썸네일 URL)를 본 뒤 받는다.
- 화질: `best` / `1080` / `720`. 기본 `1080`.
- 출력: 사용자가 고른 폴더 + yt-dlp 템플릿 `%(title).200B [%(id)s].%(ext)s`. 확장자는 병합 후 **mp4**를 우선한다.
- 진행률 % (가능하면), 취소, Jobs 기록·다시 실행.
- 홈 환경 카드에 **yt-dlp 있음/없음**을 표시한다.
- 재생목록 URL(`list=`만 있고 영상 id가 없음, 또는 `/playlist`)은 **거절**하고 `download.playlistLater` 문구를 보여 준다.

### Phase 1 비목표

- 재생목록, 채널, URL 여러 줄.
- 쿠키, 브라우저에서 쿠키 가져오기, 로그인.
- 자막 받기, 챕터, 라이브 녹화, SponsorBlock.
- 오디오만 (mp3/m4a).
- Vimeo 등 YouTube가 아닌 사이트.
- yt-dlp를 git에 커밋하거나, 1차에서 `--release` 정적 핀을 필수화하는 것.

### Phase 2 목표 (1차 성공 후)

- 재생목록 URL 또는 여러 줄 URL.
- 항목 목록(제목, id, 길이). 체크박스로 고른 것만.
- **한 항목씩** 같은 Phase 1 다운로더를 호출. 실패는 그 항목만 에러로 남기고 다음으로.
- 출력은 사용자가 고른 **폴더**. 파일 이름은 Phase 1과 같은 템플릿.
- 전체 진행: `3 / 12` + 현재 파일 %.

### Phase 2 비목표

- 병렬 여러 yt-dlp (디스크·밴 위험).
- 쿠키/로그인.
- 채널 전체 구독 동기화.

---

## 2. 현재 vs 목표

| 항목 | 현재 | Phase 1 | Phase 2 |
|------|------|---------|---------|
| 입력 | 로컬 파일만 | YouTube watch URL | 재생목록 + URL 목록 |
| 사이드카 | ffmpeg, ffprobe | + `yt-dlp` | 동일 |
| 환경 카드 | ffmpeg/ffprobe/HW | + yt-dlp 버전·출처 | 동일 |
| 진행 | FFmpeg `time=` | yt-dlp `%` 파싱 → 같은 진행 이벤트 | 항목 인덱스 + % |
| 취소 | FFmpeg 자식 kill | yt-dlp 자식 kill | 현재 항목 kill, 대기열 중단 |

---

## 3. URL 규칙

`src-tauri/src/services/ytdlp.rs`에 순수 함수.

허용 호스트 (대소문자 무시, `www.` 제거 후):

- `youtube.com`
- `m.youtube.com`
- `music.youtube.com`
- `youtu.be`
- `youtube-nocookie.com`

그 외 → `InvalidArgument("only YouTube URLs are supported")`.

`http`/`https`만. 자바스크립트 URL, `file:`, 상대 경로 금지.

### Phase 1

영상 id가 있어야 한다.

- `youtu.be/<id>`
- `youtube.com/watch?v=<id>`
- `youtube.com/shorts/<id>`
- `youtube.com/embed/<id>`
- `youtube.com/live/<id>`

`/playlist` 이거나 `v=` 없이 `list=`만 있으면:

`InvalidArgument("playlists are not supported yet")`

`watch?v=ID&list=PL...`처럼 **영상 id가 있으면** 그 영상만 받는다 (`--no-playlist`).

### Phase 2에서 추가

- `/playlist?list=`
- `watch?v=&list=`를 재생목록 모드로 열면 목록 전체 (UI 토글, 기본은 영상만).
- textarea의 URL 여러 줄. 빈 줄 무시. 잘못된 줄은 목록에 에러로.

단위 테스트 (네트워크 없음): 위 허용/거절 표.

---

## 4. yt-dlp 인자

```rust
pub enum DownloadQuality {
    Best,
    Height(u32), // 1080 or 720 in Phase 1
}

pub fn build_probe_args(url: &str) -> Vec<String>;
pub fn build_download_args(
    url: &str,
    output_template: &str, // directory + filename template
    quality: DownloadQuality,
    ffmpeg_dir: &str,      // parent dir of the ffmpeg binary we will spawn
) -> Result<Vec<String>, AppError>;
```

### 미리보기 (`probe`)

```
-J --no-download --no-playlist --no-warnings <url>
```

stdout JSON에서 `title`, `duration` (초), `uploader`, `id`, `thumbnail`, `is_live`만 쓴다. `is_live == true`면 1차에서 거절 (`live streams are not supported`).

### 받기 (`download`)

공통:

```
--no-playlist
--newline
--no-warnings
--merge-output-format mp4
--ffmpeg-location <ffmpeg_dir>
-o <output_template>
```

화질:

| UI | `-f` |
|----|------|
| best | `bv*+ba/b` |
| 1080 | `bv*[height<=1080]+ba/b[height<=1080]` |
| 720 | `bv*[height<=720]+ba/b[height<=720]` |

Windows 경로의 `-o`는 그대로 둔다. 템플릿 기본값:

```
{folder}/{sanitized}%(title).200B [%(id)s].%(ext)s
```

폴더는 `save` 다이얼로그의 **디렉터리**(파일 저장이 아니라 폴더 선택). 파일이 이미 있으면 yt-dlp 기본(다시 받기 또는 스킵) 대신 `--no-overwrites`를 쓰고, 존재하면 `InvalidArgument`가 아니라 진행 메시지 후 그 경로를 성공으로 돌려도 된다. **1차는 `--no-overwrites` + 이미 있으면 에러**가 단순하다.

`--cookies` / `--cookies-from-browser` / `--username` **금지**. 테스트가 이 플래그가 argv에 없음을 단언한다.

### 진행률

yt-dlp `--newline` 줄에서 `[download]` 와 `%`를 파싱한다.

```
[download]  12.3% of  10.00MiB at  1.20MiB/s ETA 00:08
```

`parse_ytdlp_percent(line) -> Option<f64>` (0–100). 병합 단계는 메시지 `Merging formats`만 보내고 %는 유지.

이벤트를 프론트가 이미 구독하는 `"ffmpeg-progress"`로 보낸다 (`ProgressPayload { job_id, percent, message }`).  
**Ruling:** 이벤트 이름을 바꾸지 않는다. `useFfmpegJob` / `useProgress`를 그대로 쓴다. 비용: 이름과 실제 프로세스가 어긋남. 새 이벤트는 모든 훅을 갈라지게 한다.

### 취소

자식을 `JobRegistry`에 등록. `cancel_job`이 죽인다. 부분 파일(`.part`)은 1차에서 지우지 않는다 (남기면 사용자가 봄).

---

## 5. IPC

`src-tauri/src/commands/download.rs`.

```rust
#[derive(Debug, Deserialize)]
pub struct ProbeDownloadOptions {
    pub url: String,
}

#[derive(Debug, Serialize)]
pub struct DownloadInfo {
    pub id: String,
    pub title: String,
    pub duration_secs: Option<f64>,
    pub uploader: Option<String>,
    pub thumbnail: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DownloadVideoOptions {
    pub url: String,
    pub output_dir: String,
    pub quality: String, // "best" | "1080" | "720"
    pub job_id: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub async fn probe_download(app: AppHandle, options: ProbeDownloadOptions) -> Result<DownloadInfo, AppError>;

#[tauri::command(rename_all = "snake_case")]
pub async fn download_video(app: AppHandle, options: DownloadVideoOptions) -> Result<String, AppError>;
// returns absolute path of the written file
```

`download_video`:

1. URL validate (Phase 1 규칙).
2. `output_dir` 비어 있으면 에러.
3. `quality` 파싱.
4. ffmpeg 바이너리 경로의 **부모 디렉터리**를 `--ffmpeg-location`에 넘긴다 (sidecar resolver가 이미 알고 있으면 그 경로).
5. `build_download_args` → spawn yt-dlp → `JobRegistry` → stdout/stderr 파싱 → 종료 코드 0이 아니면 `AppError::Ffmpeg`와 비슷한 `AppError` 변형.  
   **Ruling:** `AppError`에 `Ytdlp(String)`을 추가한다. 프론트는 `String(err)`로 토스트. 기존 변형의 의미를 바꾸지 않는다.

받은 파일 경로: yt-dlp `--print after_move:filepath` 또는 마지막 `Destination:` 줄을 파싱. 단위 테스트로 파서를 고정한다.

Phase 2에서 **같은 파일에** 추가 (지금 구현 금지):

```rust
pub async fn probe_download_list(...) -> Result<Vec<DownloadInfo>, AppError>;
```

프론트 `src/lib/tauri/download.ts` — `commands.ts`에 넣지 않는다. `null` 패턴은 timeline.ts와 같다.

`jobReplay`: `command: "download_video"`, args `{ options: { url, output_dir, quality, job_id } }`.

---

## 6. 사이드카 / 환경

### 이름

`src-tauri/src/utils/binary.rs`:

```rust
pub const YTDLP_SIDECAR: &str = "binaries/yt-dlp";
```

파일: `src-tauri/binaries/yt-dlp-<triple>[.exe]` (gitignore 유지).

`tauri.conf.json` `externalBin`에 `"binaries/yt-dlp"` 추가.

`sidecar.rs`에 `spawn_ytdlp` — ffmpeg와 같은 sidecar-then-PATH.

### 설치 (dev)

`scripts/setup-sidecars.js`가 **ffmpeg/ffprobe에 더해** `yt-dlp`를 찾는다.

찾는 순서: `PATH`의 `yt-dlp` / `yt-dlp.exe`, Homebrew `/opt/homebrew/bin/yt-dlp`, `/usr/local/bin/yt-dlp`.

없으면 **ffmpeg는 지금처럼 성공**하고, yt-dlp만 경고를 출력한다. 앱은 뜨고, `/download`와 환경 카드가 “없음”을 보여 준다.

문서: `brew install yt-dlp` / `pipx install yt-dlp` / Windows `winget install yt-dlp.yt-dlp`.

### 설치 (release 핀)

1차 **비목표**. Phase 1 뒤에 `sidecar-lock.json`에 yt-dlp 공식 릴리스 에셋+sha256을 넣는 후속. 1차 `setup:sidecars --release`는 **ffmpeg만** 지금처럼 받는다.

### 환경 카드

`EnvironmentInfo`에 필드 추가 (기존 필드 삭제·개명 금지):

```rust
pub ytdlp_ok: bool,
pub ytdlp_version: Option<String>,
pub ytdlp_source: Option<String>, // "sidecar" | "path"
pub ytdlp_sidecar: String,
```

프론트 `EnvironmentInfo` 미러 + 홈 카드 한 줄. i18n 한/영.

---

## 7. Phase 1 UI

### 라우트

- `src/app/download/page.tsx`
- 사이드바 **변환** 그룹, Extract 위: `{ href: "/download", labelKey: "nav.download", icon: Download }`
- 홈 카드. `hrefWithFile` 쓰지 않음 (입력이 URL).
- i18n ko/en: `nav.download`, `home.feat.download*`, `download.*`

### 화면

```
URL [                    ] [미리보기]
제목 / 업로더 / 길이 / 썸네일
화질  [1080 ▼]   폴더 [        ] [찾기]
[받기]  [취소]
진행률 바
```

동작:

1. 미리보기 → `probe_download`. 실패 토스트 (비공개/연령/라이브/재생목록).
2. 폴더 기본값: 마지막 사용 폴더를 `localStorage` `video-rs:download-dir`에. 없으면 비움.
3. 받기 → `useFfmpegJob("Download")` + `download_video`.
4. 성공 → 반환 경로로 `rememberFile`, `toastJobDone`, 뷰어·타임라인 링크 (`hrefWithFile`).

키보드: 이 페이지에서 URL 입력 중 Space는 재생이 아님 (input이면 플레이어 단축키가 이미 무시됨).

---

## 8. 파일 맵

### Phase 1에서 만든다

| 경로 | 책임 |
|------|------|
| `src-tauri/src/services/ytdlp.rs` | URL 규칙, argv, % 파싱, 출력 경로 파싱 |
| `src-tauri/src/commands/download.rs` | `probe_download`, `download_video` |
| `src/lib/tauri/download.ts` | invoke 래퍼 |
| `src/app/download/page.tsx` | UI |

### Phase 1에서 고친다

| 경로 | 변경 |
|------|------|
| `utils/binary.rs` | `YTDLP_SIDECAR` |
| `services/sidecar.rs` | `spawn_ytdlp` |
| `models/error.rs` | `Ytdlp(String)` |
| `models/environment.rs` + environment service | yt-dlp 필드 |
| `lib.rs` / `commands/mod.rs` / `services/mod.rs` | 등록 |
| `tauri.conf.json` | `externalBin` |
| `scripts/setup-sidecars.js` | yt-dlp 링크/복사 (없어도 ffmpeg는 성공) |
| `src/lib/types/video.ts` | `EnvironmentInfo` 필드 |
| Sidebar, home, i18n | 내비 |
| `docs/spec_v0.1.0.md`, README 한/영 | 한 줄 + 한계 (로그인 없음) |

### 건드리지 않는다

- 기존 도구 페이지, 타임라인 컴파일러.
- `FFmpegService::run` 본문 (진행 이벤트 emit 함수만 재사용하거나 ytdlp 러너가 같은 `ProgressPayload`를 emit).
- FFmpeg `--release` lockfile 에셋.

### Phase 2에서 추가 (지금은 만들지 않음)

- `probe_download_list`
- 페이지에 목록 테이블 + 순차 루프
- 재생목록 URL 허용

---

## 9. 테스트

### 단위 (항상)

`ytdlp.rs`:

1. 허용 URL / 거절 호스트 / 재생목록만 / `watch?v=&list=`는 Phase 1에서 `--no-playlist` 대상(validate Ok).
2. `build_download_args`에 `--cookies` 없음, `--ffmpeg-location` 있음, 1080 필터 문자열 고정.
3. `parse_ytdlp_percent` 샘플 줄.
4. `parse_destination_path` 샘플 줄.

### 네트워크

기본 CI에 넣지 않는다. 선택:

```
VIDEO_RS_YT=1 cargo test --manifest-path src-tauri/Cargo.toml ytdlp::live -- --test-threads=1
```

짧은 **Creative Commons** YouTube id를 문서에만 적고, 테스트는 env가 있을 때만 받는다. 실패해도 `ci.yml`의 `rust` / `smoke` 잡은 유지.

---

## 10. 작업 순서

### Phase 1

- [x] **Task 1 — URL 규칙 + argv + 파서 + 단위 테스트**
  - 생성: `services/ytdlp.rs`, `services/mod.rs`에 모듈.
  - 네트워크 없음. `cargo test --manifest-path src-tauri/Cargo.toml ytdlp::`
  - 커밋: `feat: add yt-dlp URL rules and argument builders`

- [x] **Task 2 — 사이드카 spawn + 환경 필드 + setup 스크립트 + externalBin**
  - `spawn_ytdlp`, `YTDLP_SIDECAR`, `EnvironmentInfo` 필드, `setup-sidecars.js`가 yt-dlp를 찾음 (없어도 0 종료).
  - 홈 카드 + TS 타입 + i18n.
  - 커밋: `feat: detect yt-dlp sidecar or PATH`

- [x] **Task 3 — IPC `probe_download` / `download_video`**
  - JobRegistry + `ffmpeg-progress` emit + `Ytdlp` 에러 + 출력 경로 반환.
  - `lib.rs` 등록.
  - 커밋: `feat: add probe_download and download_video commands`

- [x] **Task 4 — `/download` 페이지**
  - 미리보기, 화질, 폴더, 받기, 취소, rememberFile, 토스트, 사이드바·홈.
  - `npm run build` 통과.
  - 커밋: `feat: add YouTube download page`

- [x] **Task 5 — 문서**
  - spec 한 절, README 한/영 한 줄, yt-dlp 설치, 재생목록은 다음 단계, 로그인 없음.
  - 커밋: `docs: document YouTube download phase 1`

**Phase 1 성공 기준**

1. 공개 watch URL을 1080으로 받으면 mp4(또는 병합된 파일)가 폴더에 생기고 Jobs에 남는다.
2. 받기 중 취소하면 자식이 죽고 상태가 cancelled.
3. 재생목록-only URL은 미리보기에서 거절된다 (`playlists are not supported yet`).
4. yt-dlp가 없으면 앱은 뜨고, 페이지/환경 카드가 설치 안내를 한다. ffmpeg 없는 것과 같은 톤.
5. `cargo test`는 네트워크 없이 통과한다.
6. 기존 도구·타임라인 IPC가 그대로다.

### Phase 2 — 재생목록 / 여러 URL (Phase 1 후)

- [ ] **Task 6 — 목록 probe + URL 여러 줄 validate**
  - `yt-dlp --flat-playlist -J`. 항목 배열.
  - 커밋: `feat: probe YouTube playlist entries`

- [ ] **Task 7 — 순차 받기 UI**
  - 체크박스, `i / n`, 항목 실패 후에도 계속, 폴더 하나.
  - 각 항목은 Phase 1 `download_video`와 **같은 argv 빌더**.
  - 커밋: `feat: download playlists sequentially`

- [ ] **Task 8 — 문서**
  - 재생목록 한계 (비공개 목록, 로그인 없음).
  - 커밋: `docs: document playlist downloads`

**Phase 2 성공 기준**

1. 공개 재생목록에서 고른 영상만 폴더에 생긴다.
2. 한 항목이 실패해도 나머지를 받는다.
3. 여러 줄 URL도 같은 순차 경로를 쓴다.

---

## 11. 위험

| 위험 | 대응 |
|------|------|
| YouTube가 포맷을 자주 바꿈 | yt-dlp를 사이드카로 분리. 앱 코드는 `-f` 문자열만. 사용자는 yt-dlp만 갱신. |
| 연령/비공개 | 쿠키 없이 실패. 메시지를 그대로 토스트. |
| CI가 유튜브를 두드림 | 기본 테스트에 네트워크 없음. |
| `externalBin`에 yt-dlp가 없는데 빌드 | 개발은 PATH fallback. `tauri:build`는 파일이 필요할 수 있음 → setup가 없으면 **placeholder가 아니라** 문서화. Tauri는 missing externalBin에서 빌드 실패할 수 있다. **Ruling:** ffmpeg와 같이 `setup-sidecars`가 심링크를 만든다. yt-dlp가 없으면 스크립트가 경고만 하고, `tauri:build` 문서는 “다운로드 기능을 묶으려면 yt-dlp를 설치하라”. CI `sidecars` 잡은 ffmpeg만 필수로 유지. yt-dlp 파일 검사는 **하지 않음**. |
| 진행 이벤트가 FFmpeg 페이지와 섞임 | `job_id`로 이미 걸러진다. |
| 제목에 슬래시 | yt-dlp `%(title)` 제한 + `.200B`. |

---

## 12. 백로그 (이 계획에서 구현하지 않음)

- 오디오만, 자막, 쿠키, 라이브, 채널 동기화.
- yt-dlp `--release` 핀.
- YouTube 이외 사이트.
- GUI E2E.

---

## 13. 구현자가 쓸 명령

```bash
# 단위
cargo test --manifest-path src-tauri/Cargo.toml ytdlp::

# 앱 (PATH에 yt-dlp 필요)
brew install yt-dlp   # 또는 pipx / winget
npm run setup:sidecars
npm run tauri:dev
```

`/download`에서 공개 영상 URL로 미리보기 → 받기. 브라우저 `npm run dev`만으로는 IPC가 없다.
