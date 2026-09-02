# Video RS E2E / 실제 파일 스모크 테스트 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 앱이 쓰는 것과 같은 Rust builder/검증 함수로 짧은 실제 미디어를 돌리고, crop 회전·무음 extract 회귀를 CI에서 잡는다.

**Architecture:** GUI/Playwright는 v1에서 하지 않는다. `VIDEO_RS_SMOKE=1`일 때만 PATH의 ffmpeg/ffprobe로 lavfi 픽스처를 만들고, `build_*_args` + `validate_*` + `parse_probe_output`을 재사용한다. 기본 `cargo test`는 ffmpeg 없이 유지한다.

**Tech Stack:** Rust `#[cfg(test)]` 모듈, `std::process::Command`, lavfi, GitHub Actions `setup-ffmpeg@v3`

**Spec:** 이 문서가 구현 명세다. 앱 동작은 [spec_v0.1.0.md](./spec_v0.1.0.md)를 따른다.

## Global Constraints

- Next.js 16 static export + Tauri v2. 브라우저 `npm run dev`는 IPC가 없다.
- 픽스처 mp4를 git에 넣지 않는다. 전부 `std::env::temp_dir()` 아래.
- 하드웨어 인코더를 smoke에서 단언하지 않는다 (`libx264` / `aac`만).
- 에러 메시지 `input has no audio stream`을 바꾸지 않는다.
- Playwright / tauri-driver / 새 npm 테스트 러너는 v1에 넣지 않는다.
- `tempfile` crate를 추가하지 않는다.
- `FFmpegService::run` / sidecar / `AppHandle`을 cargo test에서 부르지 않는다.
- README는 이 플랜에서 고치지 않는다 (부모 PR이 Testing 절에 링크).

---

현재 CI는 인자 빌더 단위 테스트와 sidecar 파일 존재만 확인한다. 최근 crop 회전·무음 extract 같은 회귀는 **실제 작은 미디어를 넣고 같은 builder + 검증 함수 + ffmpeg/ffprobe를 돌릴 때** 잡힌다.

## 1. 목표 / 비목표

### 목표

- 앱이 실제로 쓰는 **같은 Rust builder / 검증 함수**로 ffmpeg를 실행하고, 산출물을 `parse_probe_output`으로 검증한다.
- 최근 회귀 2건을 고정한다.
  - crop 좌표는 **coded size가 아니라 display size**(displaymatrix / `tags.rotate`) 기준.
  - 오디오 스트림이 없으면 extract는 ffmpeg stderr가 아니라 **`InvalidArgument("input has no audio stream")`** 로 끝난다.
- Clips 페이지와 같이 `trim_video`와 동일한 `build_trim_args`를 **순차 2회** 호출하는 경로를 커버한다.
- 픽스처는 커밋하지 않는다. 테스트가 lavfi로 1–2초 클립을 만든다.
- 기본 `cargo test`(현재 rust CI)는 ffmpeg 없이 그대로 빠르게 통과한다.
- 새 smoke CI job은 Ubuntu / Windows / macOS에서 PATH의 ffmpeg로 돈다.

### 비목표 (v1)

- Playwright, tauri-driver, WebView 클릭, 파일 다이얼로그, toast, i18n.
- `npm run dev`에서 `invoke()`.
- `FFmpegService::run` / sidecar spawn / `cancel_job` 프로세스 킬.
- 하드웨어 인코더 성공 단언.
- 대용량 실사용 영상, 픽셀 퍼펙트 diff, loudnorm 수치.
- 프론트 테스트 러너 도입.
- crop에 transpose를 새로 넣는 제품 변경. 앱은 지금처럼 `display_size`로 검증하고, ffmpeg 기본 autorotate에 맡긴다.

## 2. 현재 테스트 레이어

| 레이어 | 위치 | 무엇을 보나 | ffmpeg? |
|--------|------|-------------|---------|
| Rust 단위 | `src-tauri/src/services/*` | builder 인자, mux map, rotation JSON, crop even snap | 없음 |
| 프론트 빌드 | `npm run build` | static export 컴파일 | 없음 |
| sidecar 설치 | `setup-sidecars.js` + CI | 파일 존재 | 설치만 |
| GUI E2E | 없음 | — | — |
| **신규 smoke** | `src-tauri/src/smoke/` | 실제 파일 in/out | PATH ffmpeg |

`lib.rs`는 `mod services`(비공개)다. 자식은 `pub mod`여도 크레이트 밖에서 못 쓴다. smoke는 **같은 크레이트** `#[cfg(test)] mod smoke`로 둔다. `src-tauri/tests/` 통합 테스트는 쓰지 않는다.

실행은 `std::process::Command`로 PATH `ffmpeg` / `ffprobe`만. sidecar 파일명(`ffmpeg-<triple>`)을 부르지 않는다.

## 3. 2단계 접근

### Phase 1 — 헤드리스 실제 파일 smoke (지금)

1. lavfi 픽스처 생성.
2. 앱과 같은 builder로 argv 작성.
3. PATH `ffmpeg` / `ffprobe` 실행.
4. `parse_probe_output`으로 결과 단언.
5. 게이트: `VIDEO_RS_SMOKE=1` (정확히 `"1"`). 없으면 즉시 return. `#[ignore]`는 쓰지 않는다.
6. 새 CI job `smoke`만 ffmpeg를 설치하고 이 테스트를 돈다. 기존 `rust` job은 손대지 않는다.

Node로 ffmpeg argv를 따로 짜지 않는다. 앱과 어긋나면 회귀를 놓친다.

### Phase 2 — 선택, 나중

`tauri:dev` + Playwright / tauri-driver. 파일 피커, Jobs rerun, 진행률 바. v1 성공의 전제가 아니다.

## 4. 파일과 최소 리팩터

| 경로 | 역할 |
|------|------|
| `src-tauri/src/smoke/mod.rs` | `VIDEO_RS_SMOKE` 게이트, 공통 skip 헬퍼 |
| `src-tauri/src/smoke/runner.rs` | PATH ffmpeg/ffprobe 실행 + probe 파싱 |
| `src-tauri/src/smoke/fixtures.rs` | lavfi 픽스처 (temp + nanos) |
| `src-tauri/src/smoke/probe.rs` | Wave 0 |
| `src-tauri/src/smoke/regressions.rs` | 무음 extract, display crop |
| `src-tauri/src/smoke/core.rs` | trim, clips 순차, concat, resize, rotate, frame |
| `src-tauri/src/smoke/tools.rs` | gif, speed, fade, volume, watermark, transcode, mux, extract |
| `src-tauri/src/lib.rs` | `#[cfg(test)] mod smoke;` |
| `src-tauri/src/services/ffprobe.rs` | `parse_probe_output` → `pub(crate)` |
| `src-tauri/src/services/ffmpeg.rs` | `validate_extract_audio` + `build_extract_audio_args` 추출. 비공개 builder `pub(crate)` |
| `.github/workflows/ci.yml` | job `smoke`만 추가 |
| `package.json` | `test:unit`, `test:smoke` |

`tempfile` crate는 넣지 않는다. `std::env::temp_dir()` + `SystemTime` 나노초 suffix.

### 4.1 `validate_extract_audio`

현재 `FFmpegService::extract_audio` (`ffmpeg.rs` 641–661행) 안의 검증을 그대로 뺀다. 메시지 문자열을 바꾸지 않는다.

```rust
pub fn validate_extract_audio(
    info: &VideoInfo,
    stream_index: Option<u32>,
) -> Result<(), AppError>
```

동작 (지금과 동일):

- `codec_type == "audio"` 트랙이 없으면 `InvalidArgument("input has no audio stream")`.
- `stream_index`가 있으면 그 **절대 인덱스**가 오디오여야 한다. 아니면 `InvalidArgument(format!("stream {idx} is not an audio track"))`.

`extract_audio`는 **지금처럼 probe 성공 시에만** 호출한다.

```rust
let info = FFprobeService::probe(app, input).await.ok();
if let Some(info) = info.as_ref() {
    validate_extract_audio(info, stream_index)?;
}
```

`AppError`의 `Display`는 `Invalid argument: …` 접두사를 붙인다. 단언은 배리언트 + **내부 문자열**로 한다.

```rust
assert!(matches!(
    err,
    AppError::InvalidArgument(ref m) if m == "input has no audio stream"
));
```

단위 테스트 2개 (`ffmpeg.rs`의 기존 `#[cfg(test)]`, 게이트 없음):

- 비디오만 있는 `VideoInfo` → `input has no audio stream`
- audio `index == 1` + `Some(1)` → ok, `Some(0)` → `stream 0 is not an audio track`

### 4.2 `build_extract_audio_args`

`extract_audio` argv는 지금 인라인이다 (`663–675`행). smoke가 두 번째 체인을 만들지 않도록 같은 파일에서 뺀다.

```rust
pub(crate) fn build_extract_audio_args(
    input: &str,
    output: &str,
    codec: &str,
    bitrate: Option<&str>,
    stream_index: Option<u32>,
) -> Vec<String>
```

체인: `input` → `Some(idx)`이면 `map("0:{idx}")` 아니면 `no_video()` → `audio_codec` → optional `audio_bitrate` → `output`. `extract_audio`는 validate 후 이 함수만 호출한다.

### 4.3 가시성 (코드 기준)

이미 `pub`인 것 — 그대로 재사용:

- `build_trim_args`, `build_concat_args`, `concat_list_contents`
- `build_transform_args`, `build_frame_args`
- `validate_crop_rect`, `snap_crop_even`, `build_crop_args`
- `StreamInfo::display_size`
- `build_gif_args`, `build_speed_args`, `build_fade_args`, `fade_out_start`
- `build_volume_args`, `build_image_watermark_args`, `OverlayPosition`
- `subtitle_codec_for_output`

지금은 `fn`(모듈 비공개)이라 smoke가 못 쓴다. **`pub(crate)`로만** 올린다. 시그니처·동작 변경 금지:

- `parse_probe_output(&Value) -> Result<VideoInfo, AppError>`
- `build_resize_args`
- `build_mux_args`
- `build_transcode_args`
- `BurnTarget` (`build_transcode_args`가 `&BurnTarget`을 받음)

`parse_probe_output`은 **`&serde_json::Value`** 를 받는다. 문자열 헬퍼를 새로 만들지 않는다. runner가 ffprobe stdout을 `Value`로 파싱한 뒤 넘긴다.

ffprobe 인자는 앱과 동일:

```
-v quiet -print_format json -show_format -show_streams <file>
```

## 5. 픽스처 (커밋하지 않음)

위치: `std::env::temp_dir().join(format!("video-rs-smoke-{nanos}"))`. 레포 루트/`src-tauri/`에 쓰지 않는다.

공통 비디오 플래그: `-y -hide_banner -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 28`. 길이 2초, 해상도 ≤ 640x480.

`in_av`만 키프레임을 짧게 (`-g 12`) 넣어 stream-copy trim이 한 GOP에 갇히지 않게 한다.

| 이름 | 내용 | 용도 |
|------|------|------|
| `in_av.mp4` | testsrc 320x240 @25fps + sine, aac, `-g 12` | 일반 happy path |
| `in_silent.mp4` | 비디오만 `-an` | extract 회귀 |
| `in_rot.mp4` | coded 640x480 + display 회전. **픽셀 transpose 금지** | crop 회귀 |
| `mark.png` | 32x32 red, 1프레임 | 워터마크 이미지 |
| `subs.srt` | 1초 `hello smoke` | 자막 mux/extract |

생성 스케치 (runner가 `Command`로 실행. Node argv 금지):

```text
in_av:
  -f lavfi -i testsrc=size=320x240:rate=25:duration=2
  -f lavfi -i sine=frequency=1000:sample_rate=44100:duration=2
  -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 28 -g 12 -c:a aac -ac 2

in_silent:
  -f lavfi -i testsrc=size=320x240:rate=25:duration=2
  -an -pix_fmt yuv420p -c:v libx264 -preset veryfast -crf 28

in_rot (2단계 — 픽셀을 돌리지 않음):
  1) testsrc 640x480 2초를 libx264로 인코드
  2) ffmpeg -display_rotation 90 -i raw.mp4 -c copy in_rot.mp4
     실패 시: -c copy -metadata:s:v:0 rotate=90
  생성 후 필수: width==640, height==480, display_size()==Some((480, 640))
  아니면 fixture 실패. rotation 부호(90 / -90)는 단언하지 않는다.

mark.png:
  -f lavfi -i color=c=red:s=32x32:d=0.04 -frames:v 1

subs.srt (파일 직접 기록):
  1
  00:00:00,000 --> 00:00:01,000
  hello smoke
```

`OnceLock`로 프로세스당 한 번 만들어도 된다. CI는 `--test-threads=1`. 게이트가 꺼져 있으면 **픽스처를 만들지 않는다**.

## 6. 테스트 웨이브

각 `#[test]` 첫 줄: `VIDEO_RS_SMOKE != "1"` 이면 return. ffmpeg 미설치여도 기본 `cargo test`는 통과해야 한다.

### Wave 0 — 기반

- **S0.1** PATH `ffmpeg -version`, `ffprobe -version` exit 0
- **S0.2** `in_av` probe: video 320x240, audio ≥ 1
- **S0.3** `in_silent`: audio 0
- **S0.4** `in_rot`: coded 640x480, `display_size() == Some((480, 640))`

### Wave 1 — 회귀 (필수)

- **S1.1** `in_silent` probe → `validate_extract_audio(&info, None)` → 내부 문자열 `input has no audio stream`. **ffmpeg 호출 금지**.
- **S1.2** 같은 info + `Some(1)` → err (`stream 1 is not an audio track`). ffmpeg 금지.
- **S1.3** display 전용 사각형 `400x600+0+0` (display 480x640에는 들어가고 coded 640x480에는 안 들어감).
  1. `validate_crop_rect(400, 600, 0, 0, 480, 640)` Ok
  2. `validate_crop_rect(400, 600, 0, 0, 640, 480)` Err
  3. 앱과 같은 순서: `display_size()`로 검증 → `snap_crop_even` → `build_crop_args` (`libx264`, crf 23)
  4. PATH ffmpeg 실행. **`-noautorotate`를 넣지 않는다** (앱도 안 넣음. 기본 autorotate가 display 좌표 crop을 가능하게 함).
  5. 출력 video ≈ 400x600 (`snap_crop_even(400,600,0,0)`은 그대로)

S1.3을 `in_av` / 픽셀 transpose 파일과 섞지 말 것. S2.6과 반대다.

### Wave 2 — 코어

- **S2.1** `build_trim_args(..., Some(0.2), Some(1.2), true)` copy. duration ≈ 1 ± 0.25
- **S2.2** `build_trim_args(..., Some(0.0), Some(0.5), false)` re-encode. duration ≈ 0.5 ± 0.15
- **S2.3** Clips 순차 (페이지와 동일):
  - 출력 이름: `src/app/clips/page.tsx`의 `clipOutputPath` — `{stem}_clip_01.mp4`, `{stem}_clip_02.mp4` (`padStart(2,"0")`)
  - 페이지 기본값 `streamCopy === false` → `build_trim_args(..., false)` 두 번
  - 구간 `[0, 0.4)`, `[0.6, 1.0)`
  - 루프: 첫 실패 시 둘째 `Command`를 돌리지 않음 (페이지 `exportQueue`와 같음)
  - 성공 시 두 파일이 있고 duration 각각 ≈ 0.4 ± 0.15
- **S2.3b** 첫 구간을 뒤집어서 `build_trim_args`가 err → `_clip_02`가 생기지 않음
- **S2.4** `concat_list_contents`로 리스트 작성(앱과 같은 이스케이프) → temp에 nanos 파일명으로 기록 → `build_concat_args(..., false)` (코덱 맞출 필요 없이 re-encode). 출력 duration ≈ 합
- **S2.5** `build_resize_args(in_av, out, 160, 120, "libx264", Some(23))` → 160x120
- **S2.6** `build_transform_args(in_av, out, 90, false, false, "libx264", Some(23))` → **픽셀** 240x320. `in_rot` 쓰지 말 것
- **S2.7** `build_frame_args(in_av, out.png, 0.5)` → 파일 `len > 100`

### Wave 3 — 나머지

하드웨어 코덱·loudnorm·drawtext(폰트 경로)는 빼다.

- **S3.1** extract 성공: `in_av` → `validate_extract_audio` ok → `build_extract_audio_args(..., "aac", Some("128k"), None)` → audio 있음, video 없음
- **S3.2** `build_gif_args(in_av, out.gif, Some(0.0), Some(1.0), 10, 160)` → 파일 존재, probe `format_name`이 gif를 포함
- **S3.3** `build_speed_args(in_av, out, 2.0, true, Some("libx264"), Some(23))` → duration ≈ 1.0 ± 0.25
- **S3.4** fade: `out_start = fade_out_start(2.0, 0.3)` (= 1.7) → `build_fade_args(..., 0.3, 0.3, out_start, true, "libx264", Some(23))` → 파일 존재. 픽셀 단언 없음
- **S3.5** `build_volume_args(in_av, out, false, 6.0)` (loudnorm 제외) → audio 있음. LUFS 단언 없음
- **S3.6** `build_image_watermark_args(in_av, mark.png, out, OverlayPosition::TopLeft, "libx264", Some(23))` → video 있음. 픽셀 diff 없음
- **S3.7** `build_transcode_args(in_av, out, "libx264", "aac", Some(23), None, None)` → video+audio
- **S3.8** mux: `build_mux_args(in_silent, in_av, out, &[], &[], &[], None, &[])` → video+audio
- **S3.9** extract subtitle: `build_mux_args(in_av, in_av, muxed, &[], &[], &[], Some(subs.srt), &[])`로 자막을 넣은 뒤 probe해서 subtitle `index`를 찾고, 앱과 같은 체인(`map 0:{idx}` + `subtitle_codec_for_output("….srt")` = `srt`)으로 추출. 파일에 `hello smoke` 포함

## 7. runner / 게이트

```rust
fn smoke_enabled() -> bool {
    matches!(std::env::var("VIDEO_RS_SMOKE"), Ok(ref v) if v == "1")
}
```

- 꺼짐: stderr에 skip 한 줄, return. temp/Command 없음.
- 켜짐: `Command::new("ffmpeg")` / `Command::new("ffprobe")`. 인자 배열은 builder `Vec<String>`을 그대로.
- ffmpeg 비-0 → 테스트 실패 (stderr를 메시지에 포함).
- Windows도 PATH 이름만 쓴다 (`.exe` 하드코딩 금지).
- 출력 경로는 같은 smoke 디렉터리 + nanos/`clip_01` 이름.

## 8. 로컬 / CI

```bash
cargo test --manifest-path src-tauri/Cargo.toml
VIDEO_RS_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml smoke:: -- --test-threads=1 --nocapture
```

PowerShell: `$env:VIDEO_RS_SMOKE = "1"` 후 동일 cargo. `package.json`의 env prefix는 POSIX(macOS/Linux)용이다. Windows 로컬은 위 PowerShell을 쓴다. `cross-env`를 넣지 않는다.

`package.json`에만 추가 (README는 부모 작업):

```json
"test:unit": "cargo test --manifest-path src-tauri/Cargo.toml",
"test:smoke": "VIDEO_RS_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml smoke:: -- --test-threads=1 --nocapture"
```

기존 `ci.yml`의 `rust` job은 **한 줄도** 바꾸지 않는다. 그 job은 게이트 없이 `cargo test`를 돌리고, smoke 테스트는 skip으로 통과한다.

새 job만 추가:

```yaml
  smoke:
    name: smoke (${{ matrix.os }})
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    defaults:
      run:
        working-directory: src-tauri
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
      - uses: FedericoCarboni/setup-ffmpeg@v3
      - name: Real-file smoke
        env:
          VIDEO_RS_SMOKE: "1"
        run: cargo test smoke:: -- --test-threads=1 --nocapture
```

`sidecars` job은 그대로 둬도 된다. 여유 있으면 `ffmpeg-* -version` 한 줄을 추가해 “파일만 있고 죽은 바이너리”를 막는다. smoke job의 성공 조건은 아니다.

## 9. 성공 기준

1. `VIDEO_RS_SMOKE` 없이 `cargo test` 통과 (ffmpeg 미설치여도).
2. `VIDEO_RS_SMOKE=1`이 로컬과 CI 3 OS에서 통과.
3. S1.1 / S1.3이 고정됨.
4. S2.3 클립 두 파일 + 첫 실패 시 둘째 미실행.
5. 픽스처가 git에 없음.
6. Playwright 없음. `tempfile` crate 없음. 기존 rust job 무변경.

## 10. 작업 순서

- [ ] **Task 1:** `validate_extract_audio` + `build_extract_audio_args` 추출. 단위 테스트 2개. `extract_audio`는 probe 성공 시에만 validate. 메시지 불변.
- [ ] **Task 2:** `parse_probe_output`, `build_resize_args`, `build_mux_args`, `build_transcode_args`, `BurnTarget`를 `pub(crate)`. 기존 단위 테스트가 그대로 통과하는지 확인.
- [ ] **Task 3:** `src-tauri/src/smoke/{mod,runner,fixtures}.rs`, `lib.rs`에 `#[cfg(test)] mod smoke`. 게이트 + PATH runner + lavfi 픽스처. `VIDEO_RS_SMOKE` 없이 `cargo test`가 ffmpeg를 부르지 않는지 확인.
- [ ] **Task 4:** Wave 0.
- [ ] **Task 5:** Wave 1 회귀 (S1.1–S1.3).
- [ ] **Task 6:** Wave 2 (S2.3/S2.3b 포함).
- [ ] **Task 7:** Wave 3.
- [ ] **Task 8:** CI job `smoke` 추가. 기존 `rust` / `frontend` / `sidecars`는 유지.
- [ ] **Task 9:** `package.json`에 `test:unit` / `test:smoke`. README는 건드리지 않음.

구현 중 금지: mock `AppHandle`, 픽스처 mp4 커밋, 기본 `cargo test`가 ffmpeg를 요구하게 만들기, Node argv 빌더, `tempfile` crate, 하드웨어 인코더 성공 단언, `input has no audio stream` 문구 변경.

## 11. Phase 2 (별도 이슈)

조건: Phase 1이 CI에서 안정된 뒤. `?file=`로 페이지를 열고 출력 경로를 입력에 직접 넣어 다이얼로그를 우회. Linux xvfb, 한 OS, nightly. v1 PR에 넣지 말 것.
