# Video RS — 타임라인 NLE 계획 (미리보기 1 → 2 → 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Phase 2는 Phase 1 성공 기준을 만족한 뒤에만 구현한다. Phase 3는 Phase 2 뒤에만.** 툴박스 페이지를 타임라인으로 합치지 않는다.

**Goal:** 기존 16개 도구 페이지는 그대로 1등 시민으로 두고, 그와 별도인 **타임라인 NLE**를 추가한다. 미리보기는 ① 배치 후 보내기·결과 재생 → ② 저해상도 프록시 → ③ 실시간 프레임 정확 스크럽 순으로 올린다.

**Architecture:** 타임라인 JSON을 **한 곳의 그래프 컴파일러**가 FFmpeg `filter_complex`로 바꾼다. 보내기·프록시·(나중) 프레임 추출이 같은 `RenderProfile`만 다르게 이 컴파일러를 쓴다. UI는 `/timeline` 한 페이지. 기존 `trim_video` / `concat_videos` / Clips는 호출하지 않는다. 실행·취소·진행률은 지금 `FFmpegService::run` + `useFfmpegJob`를 재사용한다.

**Tech Stack:** Tauri v2 IPC, Rust (`services/timeline/*`), Next.js 16 static export, 기존 video.js 플레이어, `localStorage` 초안 + `.video-rs.json` 프로젝트 파일. 새 네이티브 디코더·WebCodecs·mpv는 Phase 3 스파이크 전까지 넣지 않는다.

**Spec:** 이 문서가 구현 명세다. 앱 동작의 기존 부분은 [spec_v0.1.0.md](./spec_v0.1.0.md)를 따른다. 툴박스 다듬기(C)는 §10이며 NLE 성공의 전제가 아니다.

## 잠근 제품 결정

대화에서 고정한 값이다. 구현 중 바꾸려면 이 절을 먼저 고친다.

| 결정 | 값 |
|------|-----|
| 기존 도구 페이지 | **본편 유지.** `/trim`, `/crop` 등을 파이프라인 단축키로 바꾸지 않는다. |
| NLE | 사이드바의 **별도 1등 화면** `/timeline`. |
| 미리보기 순서 | **1 → 2 → 3.** 1차를 건너뛰고 실시간 스크럽을 먼저 하지 않는다. |
| 실행 엔진 | UI는 둘, **그래프 컴파일러는 하나.** |
| Phase 1 미리보기 | 클립을 고르면 **원본**을 재생(in/out). 보내기 후 **결과 파일**을 재생. 플레이헤드가 합성을 그리지 않는다. |
| Phase 1 트랙 | UI는 **V1 + A1.** 모델은 N트랙을 허용하되, Phase 1 컴파일러는 비디오 트랙 1개만 받는다. |
| 같은 트랙 겹침 | Phase 1에서 **거부.** 나중에 V2 오버레이로 푼다. |
| 트랜지션 | Phase 1·2 비목표. Phase 3 이후. |
| 클립별 FX (crop/speed 등) | Phase 1 비목표. 모델에 빈 `effects: []`만 예약. |
| 기존 concat/clips | 그대로 둔다. 타임라인이 이 명령을 부르지 않는다. |

---

## Global Constraints

- Next.js 16 static export + Tauri v2. 브라우저 `npm run dev`는 IPC가 없다.
- 인자는 **snake_case**. `Option<T>`는 IPC에서 `null`이지 `undefined`가 아니다.
- 새 연산 빌더는 `src-tauri/src/services/ffmpeg.rs`에 넣지 않는다. 그 파일은 실행기·기존 도구용이다.
- `FFmpegService::run` / `JobRegistry` / `ffmpeg-progress` / `cancel_job` / `useFfmpegJob`를 재사용한다. 두 번째 잡 시스템을 만들지 않는다.
- 기본 `cargo test`는 ffmpeg 없이 통과한다. 실제 파일 검증은 `VIDEO_RS_SMOKE=1` 스모크에만 추가한다.
- Playwright / tauri-driver / 프론트 테스트 러너는 이 계획에서 도입하지 않는다.
- `assetProtocol.scope`, CSP, bundle id, LICENSE, 정적 sidecar는 이 계획의 범위가 아니다 (배포 트랙 A).
- 기존 도구 IPC 시그니처를 바꾸지 않는다.

---

## 1. 목표 / 비목표

### Phase 1 목표 (지금 구현)

- `/timeline`에서 여러 파일의 구간을 V1에 놓고, 추가 오디오를 A1에 놓고, 자르고 옮기고 삭제한 뒤 **한 번 인코딩**으로 한 파일을 만든다.
- 빈 구간은 검정 / 무음으로 채운다.
- 프로젝트를 `.video-rs.json`으로 저장·연다. 새로고침 대비 초안은 `localStorage`.
- 미리보기: 선택 클립 = 원본 seek, 프로그램 모니터 = 직전 보내기 결과(없으면 안내).
- 그래프 컴파일러가 `RenderProfile`을 받는다. Phase 2 프록시는 이 함수의 프로파일만 바꾼다.

### Phase 1 비목표

- 플레이헤드 합성, 프록시 자동 생성, 실시간 스크럽.
- 비디오 트랙 2개 이상, PiP, 트랜지션, 클립별 crop/speed/fade.
- 리플 삭제·롤 트림·마그네틱 타임라인. Phase 1은 **갭 허용 + 겹침 거부.**
- Clips/Concat/Trim 페이지 리팩터. 공유할 것은 잡 실행뿐이다.
- 네이티브 디코더, WebCodecs, mpv, ffmpeg-next.

### Phase 2 목표 (1차 성공 후)

- 같은 컴파일러로 저해상도 프록시를 만들고, 프로그램 모니터가 그 파일을 재생한다.
- 타임라인 시각 ≈ 프록시 시각. 플레이헤드 seek는 프록시 파일에 한다.
- 프로젝트가 바뀌면 dirty. 디바운스 후 프록시를 다시 뽑는다.

### Phase 3 목표 (2차 성공 후)

- 플레이헤드마다 합성 프레임. 별도 PreviewBackend. **먼저 스파이크.**
- 보내기 경로(컴파일러 + `FFmpegService::run`)는 바꾸지 않는다.

---

## 2. 현재 vs 목표

| 항목 | 현재 | Phase 1 | Phase 2 | Phase 3 |
|------|------|---------|---------|---------|
| 여러 구간 | Clips가 파일마다 따로 trim | 타임라인에 놓고 한 출력 | 동일 | 동일 |
| 이어붙이기 | 파일 전체 concat demuxer | `filter_complex` trim+concat+갭 | 동일 + 프록시 프로파일 | 동일 |
| 미리보기 | 단파일 video.js | 원본 또는 결과 파일 | 프록시 파일 | 프레임 엔진 |
| 프로젝트 | 없음 | `.video-rs.json` | 프록시 캐시 경로 추가 | 미리보기 캐시 |
| 도구 페이지 | 16개 본편 | **유지** | 유지 | 유지 |

런타임 재사용:

```
TimelineProject
    → validate_timeline
    → build_timeline_args(project, RenderProfile)
    → FFmpegService::run(...)
    → ffmpeg-progress / cancel_job
```

지금 concat은 파일 전체 + 임시 concat list이다. in/out·갭·A1 믹스에 맞지 않다. **재사용하지 않는다.**

---

## 3. 데이터 모델

프론트 `src/lib/timeline/types.ts`와 Rust `services/timeline/model.rs`가 **같은 snake_case 필드**를 쓴다. serde 기본값. 버전 필드가 없으면 로드 실패.

```rust
pub const TIMELINE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineProject {
    pub version: u32,
    pub name: String,
    pub fps: f64,
    pub width: u32,
    pub height: u32,
    pub sample_rate: u32,
    pub tracks: Vec<TimelineTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineTrack {
    pub id: String,
    pub kind: TrackKind,
    pub name: String,
    pub muted: bool,
    pub clips: Vec<TimelineClip>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TrackKind {
    Video,
    Audio,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineClip {
    pub id: String,
    pub source_path: String,
    /// Source seconds, inclusive start.
    pub source_in: f64,
    /// Source seconds, exclusive end. Must be > source_in.
    pub source_out: f64,
    /// Timeline seconds where this clip starts.
    pub timeline_start: f64,
    /// Reserved. Phase 1 must be empty. Unknown items → validate error.
    #[serde(default)]
    pub effects: Vec<ClipEffect>,
}

/// Phase 1: no variants are accepted. Keep the enum so Phase 2+ can add
/// `Crop`, `Speed`, … without renaming the field.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClipEffect {
    // no variants in v1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderProfile {
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub video_codec: String,
    pub audio_codec: String,
    pub crf: Option<u8>,
    pub video_bitrate: Option<String>,
    pub preset: Option<String>,
    pub audio_bitrate: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineValidation {
    pub duration_secs: f64,
    pub warnings: Vec<String>,
}
```

### 불변식 (validate)

1. `version == 1`.
2. `fps` ∈ (0, 120], `width`·`height` 짝수이고 ≥ 2, `sample_rate` ∈ {44100, 48000}.
3. 트랙 `id`·클립 `id` 중복 없음.
4. 각 클립: `source_path` 비어 있지 않음, `source_out > source_in`, `source_in >= 0`, `timeline_start >= 0`.
5. 같은 트랙에서 `[timeline_start, timeline_start + dur)` 겹치면 `InvalidArgument`.
6. Phase 1 컴파일러: `kind == video` 트랙이 **정확히 1개**, `kind == audio` 트랙은 **0 또는 1개.** 그 외는 `InvalidArgument("phase 1 supports one video track and at most one audio track")`.
7. `effects`가 비어 있지 않으면 `InvalidArgument("clip effects are not supported yet")`.
8. `muted` 트랙은 그 트랙을 그래프에 넣지 않는다. V1이 mute면 검정 캔버스만 (길이는 유지).

헬퍼:

```rust
impl TimelineClip {
    pub fn source_duration(&self) -> f64 {
        self.source_out - self.source_in
    }
    pub fn timeline_end(&self) -> f64 {
        self.timeline_start + self.source_duration()
    }
}

impl TimelineProject {
    pub fn duration_secs(&self) -> f64 {
        self.tracks
            .iter()
            .flat_map(|t| t.clips.iter())
            .map(TimelineClip::timeline_end)
            .fold(0.0_f64, f64::max)
    }
}
```

### 기본 프로젝트

UI가 빈 타임라인을 열 때:

- `name`: `"Untitled"`
- `fps`: `30.0`
- `width`/`height`: 첫 비디오 클립을 넣을 때 그 클립의 **display** 크기(짝수로 스냅). 이후 클립은 `scale+pad`로 맞춤. 사용자가 출력 해상도를 바꾸면 그 값이 이긴다.
- `sample_rate`: `48000`
- 트랙: `{ id: "V1", kind: video, name: "V1" }`, `{ id: "A1", kind: audio, name: "A1" }`

---

## 4. 그래프 컴파일러

파일: `src-tauri/src/services/timeline/graph.rs`.

```rust
pub fn build_timeline_args(
    project: &TimelineProject,
    output: &str,
    profile: &RenderProfile,
) -> Result<Vec<String>, AppError>
```

`FFmpegCommandBuilder`로 argv만 만든다. spawn하지 않는다.

### RenderProfile 프리셋

```rust
impl RenderProfile {
    /// Phase 1 export default.
    pub fn export(project: &TimelineProject) -> Self {
        Self {
            width: project.width,
            height: project.height,
            fps: project.fps,
            video_codec: "libx264".into(),
            audio_codec: "aac".into(),
            crf: Some(23),
            video_bitrate: None,
            preset: Some("medium".into()),
            audio_bitrate: Some("192k".into()),
        }
    }

    /// Phase 2. Do not call from Phase 1 UI.
    pub fn proxy(project: &TimelineProject) -> Self {
        let w = 640u32;
        let h = ((project.height as f64) * (640.0 / project.width as f64)).round() as u32;
        let h = if h % 2 == 0 { h } else { h + 1 };
        Self {
            width: w,
            height: h.max(2),
            fps: project.fps.min(30.0),
            video_codec: "libx264".into(),
            audio_codec: "aac".into(),
            crf: Some(28),
            video_bitrate: None,
            preset: Some("ultrafast".into()),
            audio_bitrate: Some("96k".into()),
        }
    }
}
```

### 입력 나열

`source_path` 등장 순으로 중복 없이 `-i`를 붙인다. 클립은 그 인덱스를 쓴다.

### 비디오 (V1)

클립을 `timeline_start`로 정렬한다. 인접 클립 사이·앞쪽 갭:

- 앞쪽 갭: `timeline_start > 0`
- 사이 갭: `next.timeline_start > prev.timeline_end()`
- 끝 패딩 없음. 타임라인 길이 = 마지막 클립 끝.

갭 필터:

```
color=c=black:s={w}x{h}:d={gap}:r={fps},format=yuv420p[{label}]
```

클립 필터 (`si` = source_in, `so` = source_out, `ii` = input index):

```
[{ii}:v]trim=start={si}:end={so},setpts=PTS-STARTPTS,fps={fps},scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1,format=yuv420p[{label}]
```

그다음 `concat=n={k}:v=1:a=0[vout]`. 클립이 없고 V1이 mute가 아니면 `duration_secs()==0` → `InvalidArgument("timeline is empty")`. V1 mute이거나 비디오 클립이 0개인데 A1만 있으면: 같은 길이의 검정 `color` 한 장 + A1.

### 오디오

두 줄기.

1. **V1 링크 오디오** (Phase 1 기본): 각 비디오 클립과 같은 in/out. 해당 입력에 오디오 스트림이 있으면

```
[{ii}:a]atrim=start={si}:end={so},asetpts=PTS-STARTPTS,aresample={sr},aformat=sample_fmts=fltp:channel_layouts=stereo[{label}]
```

없으면 같은 길이 `anullsrc=r={sr}:cl=stereo`. 갭은 `anullsrc` + `atrim=end={gap}`. 비디오와 같은 순서로 `concat=n={k}:v=0:a=1[a_v1]`.

2. **A1**: 클립마다 `adelay`로 `timeline_start`만큼 민 뒤, 타임라인 길이에 `apad` / `atrim`. 클립이 여러 개면 `amix=inputs={n}:duration=longest:dropout_transition=0[a_a1]`.

최종:

- A1 없음 또는 mute: `[a_v1][aout]`에 연결 (라벨만 `[aout]`).
- A1 있음: `[a_v1][a_a1]amix=inputs=2:duration=first:dropout_transition=0[aout]`.
- V1 mute + A1만: `[a_a1]` → `[aout]`, 비디오는 검정.

맵: `-map [vout] -map [aout]`.

인코더: `profile.video_codec` / `audio_codec`, `apply_video_quality`, `preset`이 있으면 `-preset`, `audio_bitrate`이 있으면 `-b:a`. 출력 경로 마지막.

### 경로 이스케이프

필터 안 경로는 Phase 1에서 쓰지 않는다 (`trim`은 입력 인덱스). `subtitles=` 같은 것은 넣지 않는다.

### 단위 테스트 (ffmpeg 없음)

`graph.rs` 안의 `#[cfg(test)]`:

1. 클립 2개, 갭 1초 → argv에 `color=` 한 번, `concat=n=3:v=1:a=0`.
2. 같은 트랙 겹침 → validate 에러.
3. 비디오 트랙 2개 → Phase 1 컴파일러 에러 메시지 고정.
4. `RenderProfile::proxy`는 `width == 640`, `preset == Some("ultrafast")`, 입력 매핑은 export와 같고 해상도·preset만 다름.
5. 빈 타임라인 → `timeline is empty`.
6. `effects` 비어 있지 않음 → 에러.

---

## 5. IPC

`src-tauri/src/commands/timeline.rs`. 기존 도구 명령은 그대로.

```rust
#[derive(Debug, Deserialize)]
pub struct ExportTimelineOptions {
    pub project: TimelineProject,
    pub output_path: String,
    pub profile: Option<RenderProfile>,
    pub job_id: Option<String>,
}

#[tauri::command(rename_all = "snake_case")]
pub fn validate_timeline(project: TimelineProject) -> Result<TimelineValidation, AppError>;

#[tauri::command(rename_all = "snake_case")]
pub async fn export_timeline(app: AppHandle, options: ExportTimelineOptions) -> Result<(), AppError>;
```

`validate_timeline`은 spawn하지 않는다. 파일을 읽지 않는다 (경로 존재는보내기 때 ffprobe/ffmpeg가 실패).

`export_timeline`:

1. `output_path` 비어 있으면 에러.
2. `validate` + `build_timeline_args(project, output, profile.unwrap_or_else(|| RenderProfile::export(&project)))`.
3. `duration_secs = project.duration_secs()`.
4. `FFmpegService::run(&app, args, Some(duration), job_id.as_deref()).await`.

Phase 2에서 **같은 파일에** 추가 (지금 구현하지 말 것):

```rust
#[tauri::command(rename_all = "snake_case")]
pub async fn render_timeline_proxy(app: AppHandle, options: ExportTimelineOptions) -> Result<(), AppError>;
```

본문은 `profile` 기본값만 `RenderProfile::proxy`인 `export_timeline`과 동일. 별도 빌더 금지.

Phase 3 예약 이름 (구현 금지, 문서만): `preview_timeline_frame`.

프론트 `src/lib/tauri/timeline.ts` — `commands.ts`에 넣지 말고 타임라인 전용 파일을 만든다. `invoke` 헬퍼는 `commands.ts`의 패턴을 복제한다 (dynamic import, `null`).

```ts
export function validateTimeline(project: TimelineProject): Promise<TimelineValidation>;
export function exportTimeline(opts: {
  project: TimelineProject;
  outputPath: string;
  profile?: RenderProfile | null;
  jobId?: string;
}): Promise<void>;
```

`jobReplay` 커맨드 이름: `"export_timeline"`. args는 `{ options: { project, output_path, profile, job_id } }`.

---

## 6. Phase 1 UI

### 라우트·네비

- 페이지: `src/app/timeline/page.tsx` (`"use client"`).
- 사이드바 **첫 그룹** (Home / Jobs / Viewer 옆): `{ href: "/timeline", labelKey: "nav.timeline" }`. 아이콘: `lucide-react` `GanttChart`.
- 홈 카드에도 같은 href. `hrefWithFile`은 쓰지 않는다. 타임라인은 파일이 여러 개라 `?file=` 모델과 맞지 않다.
- i18n `ko`/`en`에 `nav.timeline`, `home.feat.timeline`, 페이지 문구를 둘 다 넣는다.

### 화면 뼈대

위: 프로그램/소스 모니터. 아래: 눈금자 + V1 + A1. 오른쪽 또는 위 툴바: 가져오기, 자르기, 삭제, 저장, 열기, 보내기.

```
+------------------+------------------+
| Source (원본)     | Program (결과)   |
| 선택 클립 video.js| 직전 출력 video.js|
+------------------+------------------+
| 툴바  눈금자(초)   playhead 선        |
| V1  [clip][ gap ][clip]             |
| A1  [     music     ]               |
+-------------------------------------+
| 출력 경로 · 코덱/CRF · 보내기 · 진행률 |
```

### 모니터 규칙 (Phase 1)

- **Source:** 선택된 클립의 `source_path`를 `toAssetUrl`로. `source_in`으로 seek. 재생은 원본. in/out 숫자 입력으로 클립을 줄이면 블록 너비가 바뀐다.
- **Program:** `lastExportPath`가 있을 때만 로드. 타임라인을 바꾸면 배지 `stale`(문구 키 `timeline.programStale`). 플레이헤드가 Program을 스크럽하지 않는다.
- 둘 다 기존 `VideoPlayer`를 쓴다. 새 플레이어 금지.

### 편집 동작

| 동작 | 동작 방식 |
|------|-----------|
| 가져오기 | `openVideoFiles()` (이미 있음). 각 파일을 probe → V1 끝에 붙임. `timeline_start = 현재 V1 duration`. `source_in=0`, `source_out=duration`. 첫 클립이면 width/height 설정. |
| A1 가져오기 | 같은 다이얼로그. A1 끝에 붙임. |
| 선택 | 클립 클릭. |
| 이동 | 드래그. 같은 트랙만. 놓았을 때 겹치면 스냅 백 + 토스트 `timeline.noOverlap`. |
| 트림 | 블록 좌우 핸들. 왼쪽은 `source_in`과 `timeline_start`를 같이 바꿔 오른쪽 끝이 고정되게. 오른쪽은 `source_out`만. 최소 길이 `1 / fps`. |
| 자르기 (razor) | 선택 클립 위에서 플레이헤드가 클립 내부일 때. 클립을 둘로: 왼쪽 `source_out = src_at_playhead`, 오른쪽 새 id, `source_in = 그 시각`, `timeline_start = playhead`. |
| 삭제 | 선택 클립 제거. 뒤 클립을 당기지 않음 (갭 생김). |
| 플레이헤드 | 눈금자 클릭/드래그. Source 모니터를 스크럽하지 않음 (Phase 1). 자르기 기준점만. |
| 줌 | 트랙 가로 배율 state. 스크롤로 시간 이동. |

키보드 (타임라인 페이지에 포커스, input 안이 아닐 때):

- `S` razor
- `Delete` / `Backspace` 삭제
- `Space` Source 재생/일시정지 (Program 아님)
- `←`/`→` 플레이헤드 ±1초, Shift면 ±1프레임

### 보내기

- 출력 기본값: 첫 클립 옆 `{stem}_timeline.mp4`. `saveFile`로 변경.
- `useFfmpegJob("Timeline")` + `exportTimeline`. replay에 project 스냅샷.
- 성공 시 `lastExportPath` 갱신, Program이 그 파일을 로드, `toastJobDone`.

### 저장

- **다른 이름으로 저장 / 열기:** 다이얼로그. 필터 `json`. 내용은 `JSON.stringify(project, null, 2)`.
- **초안:** `localStorage` 키 `video-rs:timeline-draft`. 클립 변경마다 디바운스 400ms. 페이지 로드 시 초안이 있으면 복원(묻지 않음. Phase 1 범위).
- 절대 경로를 저장한다. 파일이 없으면보내기 때 FFmpeg 에러가 그대로 토스트에 난다.

---

## 7. 파일 맵

### Phase 1에서 만든다

| 경로 | 책임 |
|------|------|
| `src-tauri/src/services/timeline/mod.rs` | 모듈 재export |
| `src-tauri/src/services/timeline/model.rs` | 타입, duration 헬퍼, `RenderProfile::{export,proxy}` |
| `src-tauri/src/services/timeline/validate.rs` | 불변식 → `TimelineValidation` |
| `src-tauri/src/services/timeline/graph.rs` | `build_timeline_args` + 단위 테스트 |
| `src-tauri/src/commands/timeline.rs` | `validate_timeline`, `export_timeline` |
| `src/lib/timeline/types.ts` | TS 미러 |
| `src/lib/timeline/project.ts` | 빈 프로젝트, 초안 load/save, 클립 편집 순수 함수 |
| `src/lib/tauri/timeline.ts` | invoke 래퍼 |
| `src/app/timeline/page.tsx` | 페이지 셸, 잡, 모니터, 저장/보내기 |
| `src/components/timeline/TimelineEditor.tsx` | 눈금자·트랙·플레이헤드 |
| `src/components/timeline/TrackLane.tsx` | 한 트랙 |
| `src/components/timeline/ClipBlock.tsx` | 블록 + 트림 핸들 |
| `src-tauri/src/smoke/timeline.rs` | 게이트된 실제 파일 스모크 |

### Phase 1에서 고친다

| 경로 | 변경 |
|------|------|
| `src-tauri/src/services/mod.rs` | `pub mod timeline;` |
| `src-tauri/src/commands/mod.rs` | `pub mod timeline;` |
| `src-tauri/src/lib.rs` | `validate_timeline`, `export_timeline` 등록 |
| `src-tauri/src/smoke/mod.rs` | `mod timeline;` |
| `src/components/layout/Sidebar.tsx` | 첫 그룹에 Timeline |
| `src/app/page.tsx` | 홈 카드 |
| `src/lib/i18n.tsx` | ko/en 키 |
| `docs/spec_v0.1.0.md` | 타임라인 절 한 단락 (부모 작업이어도 이 계획이 초안을 적음) |

### 건드리지 않는다

- `services/ffmpeg.rs`의 concat/trim/transcode 본문. 빌더 메서드(`input`, `filter_complex`, `map`, `apply_video_quality`)만 쓴다.
- 기존 도구 페이지, Clips, Concat.
- `useFfmpegJob` 시그니처.
- sidecar / release / signing.

### Phase 2에서 추가 (지금은 만들지 않음)

- `render_timeline_proxy` 명령 (commands/timeline.rs에 추가)
- `src/lib/timeline/proxy.ts` — dirty 해시, 디바운스, 캐시 경로
- Program 모니터가 프록시를 재생
- `TimelineProject`에 필드 추가 금지. 프록시는 세션 state.

### Phase 3에서 추가 (지금은 만들지 않음)

- `src-tauri/src/services/preview/` — 스파이크 후 선정된 백엔드
- `preview_timeline_frame` 또는 스트리밍 프로토콜
- video.js Program 경로를 프레임 뷰어로 교체

---

## 8. 프론트 순수 함수

`src/lib/timeline/project.ts`. UI 핸들러가 여기만 부른다. 겹침 검사는 Rust와 같은 규칙.

```ts
export function emptyProject(): TimelineProject;

export function addClip(
  project: TimelineProject,
  trackId: string,
  clip: TimelineClip,
): TimelineProject;

export function moveClip(
  project: TimelineProject,
  clipId: string,
  timelineStart: number,
): { ok: true; project: TimelineProject } | { ok: false; reason: "overlap" | "missing" };

export function trimClip(
  project: TimelineProject,
  clipId: string,
  edge: "in" | "out",
  sourceTime: number,
  fps: number,
): { ok: true; project: TimelineProject } | { ok: false; reason: string };

export function splitClip(
  project: TimelineProject,
  clipId: string,
  timelineTime: number,
  newId: string,
): { ok: true; project: TimelineProject } | { ok: false; reason: string };

export function removeClip(project: TimelineProject, clipId: string): TimelineProject;

export function projectHash(project: TimelineProject): string; // JSON stable stringify — Phase 2 dirty key. Implement in Phase 1 so the compiler contract exists.
```

`splitClip` 규칙: `timelineTime`이 `(start, end)` 안에 있어야 한다. 경계면 `reason: "at-edge"`.

`trimClip` 최소 길이: `1 / fps`. in 트림은 `timeline_start += delta`, `source_in += delta` (`delta = sourceTime - source_in`).

이 함수들은 프론트 테스트 러너가 없으므로, **같은 규칙을 Rust `validate` + 편집은 UI에서 호출 →보내기 전 `validate_timeline`** 으로 막는다. 핵심 동치 테스트는 Rust 쪽에 `split`/`overlap`을 `validate.rs` 테스트로 둔다. 프론트 `splitClip`은 그 불변식을 문장 그대로 따른다.

Rust에도 같은 편집이 필요하지는 않다. 서버 상태는 없다. 검증과 컴파일만 Rust.

---

## 9. 작업 순서

### Phase 1

- [ ] **Task 1 — 모델 + validate + 단위 테스트**
  - 생성: `services/timeline/{mod,model,validate}.rs`, `services/mod.rs`에 모듈 추가.
  - 테스트: 겹침, 빈 타임라인 duration 0, effects 비어 있지 않음, 비디오 트랙 2개, 정상 2클립+갭 duration.
  - `cargo test --manifest-path src-tauri/Cargo.toml timeline::` 통과.
  - 커밋: `feat: add timeline project model and validation`

- [ ] **Task 2 — 그래프 컴파일러 + 단위 테스트**
  - 생성: `services/timeline/graph.rs`.
  - `build_timeline_args`가 §4 필터를 내고, `RenderProfile::export` / `::proxy`가 해상도·preset만 다르게 같은 입력을 쓰는지 단언.
  - ffmpeg 실행 없음.
  - 커밋: `feat: compile timeline projects to ffmpeg filter graphs`

- [ ] **Task 3 — IPC**
  - 생성: `commands/timeline.rs`. 등록: `commands/mod.rs`, `lib.rs`.
  - `export_timeline`은 validate → build → `FFmpegService::run`.
  - 경로 비어 있으면 `InvalidArgument`.
  - 커밋: `feat: add validate_timeline and export_timeline commands`

- [ ] **Task 4 — 스모크 (VIDEO_RS_SMOKE=1)**
  - 생성: `smoke/timeline.rs`, `smoke/mod.rs`에 연결.
  - lavfi 픽스처 2개(기존 `fixtures` 재사용 가능하면 재사용). 클립 A 0–0.5s, 갭 0.25s, 클립 B 0–0.5s.
  - 두 번째 케이스는 **해상도가 다른** 두 소스(예: 320×240과 640×360)를 같은 프로젝트 width/height로 보냄. `scale+pad`가 컴파일러에 있는지 여기서 잡는다.
  - `build_timeline_args` + PATH ffmpeg + `parse_probe_output`.
  - 단언: 출력 duration ≈ 1.25s (±0.15), 비디오 있음, 해상도 = project width/height.
  - A1만 있는 케이스 1개: 검정 비디오 + 오디오 스트림 ≥ 1.
  - 게이트 끄면 즉시 return. 기존 smoke와 같은 패턴.
  - 커밋: `test: smoke timeline concat with gap`

- [ ] **Task 5 — 프론트 타입·편집 함수·IPC 래퍼**
  - 생성: `src/lib/timeline/types.ts`, `project.ts`, `src/lib/tauri/timeline.ts`.
  - `projectHash` 포함 (Phase 2가 쓸 안정 직렬화).
  - 커밋: `feat: add timeline TypeScript model and invoke wrappers`

- [ ] **Task 6 — 타임라인 에디터 UI (보내기 없이 편집 가능)**
  - 생성: `components/timeline/{TimelineEditor,TrackLane,ClipBlock}.tsx`.
  - 가져오기 / 이동 / 트림 / razor / 삭제 / 플레이헤드 / 줌.
  - 겹침이면 토스트, state 롤백.
  - 커밋: `feat: add timeline editor canvas`

- [ ] **Task 7 — 페이지, 모니터, 저장, 보내기, i18n, nav**
  - 생성: `src/app/timeline/page.tsx`.
  - 수정: Sidebar, home `page.tsx`, `i18n.tsx`.
  - Source = 선택 클립 원본. Program = 직전 출력만.
  - `useFfmpegJob` + Show 토스트. 초안 localStorage. json 저장/열기.
  - `npm run build` 통과.
  - 커밋: `feat: add timeline page with export-only preview`

- [ ] **Task 8 — 문서**
  - `docs/spec_v0.1.0.md`에 타임라인·미리보기 단계 한 절.
  - README 표에 Timeline 한 줄 (한/영).
  - 커밋: `docs: document timeline NLE phase 1`

**Phase 1 성공 기준**

1. 도구 페이지가 이전과 같이 동작한다 (IPC 불변).
2. 두 클립과 갭 하나를 타임라인에 놓고 보내면 한 파일이 나오고, 가운데가 검정이다.
3. A1에 오디오를 올리면 결과에 섞인다.
4. 보내기 전 Program은 원본 합성을 재생하지 않는다. 보낸 뒤에만 결과 파일이 나온다.
5. `cargo test`는 ffmpeg 없이 통과하고, `VIDEO_RS_SMOKE=1`에서 timeline 스모크가 통과한다.
6. `RenderProfile::proxy` 단위 테스트가 이미 있다. UI는 아직 호출하지 않는다.

### Phase 2 — 프록시 미리보기 (Phase 1 머지 후)

- [ ] **Task 9 — `render_timeline_proxy`**
  - `export_timeline`과 동일, 기본 프로파일만 `RenderProfile::proxy`.
  - 스모크: 출력 width == 640, duration은 export와 동일 허용오차.
  - 커밋: `feat: render low-res timeline proxy`

- [ ] **Task 10 — 세션 프록시 캐시**
  - 생성: `src/lib/timeline/proxy.ts`.
  - 키 = `projectHash(project)`. 값이 바뀌면 dirty.
  - 디바운스 800ms 후 `render_timeline_proxy` → 임시 경로 (`{temp}/video-rs-proxy-{hash}.mp4`). 이전 프록시 파일 삭제.
  - 빈 타임라인은 호출하지 않음.
  - 커밋: `feat: debounce and cache timeline proxy renders`

- [ ] **Task 11 — Program 모니터가 프록시를 재생**
  - 프록시가 있으면 Program = 프록시. 플레이헤드 seek = 프록시 시각.
  - dirty이거나 렌더 중이면 배지 `timeline.proxyUpdating`. 직전 프록시가 있으면 그걸 유지.
  - 선택 클립 Source 모니터는 **원본 유지** (in/out 맞출 때).
  - 최종 보내기는 여전히 `export_timeline` + full profile.
  - 커밋: `feat: play timeline proxy in the program monitor`

**Phase 2 성공 기준**

1. 타임라인을 고치면 1초 안에 프록시 잡이 시작되고, 끝나면 Program이 대략적인 결과를 재생한다.
2. 플레이헤드를 옮기면 프록시가 seek된다. 원본 파일을 이어 붙인 듯이 보이지 않는다.
3. 보내기 산출물은 Phase 1과 같은 컴파일러·해상도(프로젝트 width/height)이다.
4. 프록시 실패는보내기를 막지 않는다. 토스트 + Program stale.

**Phase 2 비목표:** 구간만 다시 뽑기, 하드웨어 프록시, V2 오버레이(별 트랙으로 미룸).

### Phase 3 — 실시간 스크럽 (Phase 2 후, 스파이크 필수)

- [ ] **Task 12 — 미리보기 엔진 스파이크 (버리는 코드)**
  - 후보를 같은 10초 타임라인에서 비교한다. 측정: 플레이헤드 이동 → 첫 픽셀까지 ms, 1080p 한 클립 / 클립 3개+갭.
  - A: 반복 `export_frame` 스타일 (기준선, 느릴 것으로 가정).
  - B: WebView WebCodecs로 소스 GOP를 디코드.
  - C: Rust ffmpeg 디코드 + 프레임을 asset으로 전달 (`ffmpeg-next` 또는 사이드카 raw).
  - D: mpv / ffplay 사이드카 IPC.
  - 산출: `docs/plan-nle-preview-spike.md`에 표. **승자 없이 Program을 갈아엎지 않는다.**
  - 커밋: `docs: record timeline preview engine spike` (스파이크 코드는 커밋하지 않거나 `src-tauri/src/smoke/preview_spike.rs`에 게이트).

- [ ] **Task 13 — PreviewBackend (스파이크 승자만)**
  - 인터페이스는 이것만 고정한다. 구현은 승자 문서 이후 별 계획.
  ```rust
  pub trait PreviewBackend {
      fn prepare(&mut self, project: &TimelineProject) -> Result<(), AppError>;
      fn frame_at(&mut self, time_secs: f64) -> Result<PreviewFrame, AppError>;
      fn invalidate(&mut self);
  }
  pub struct PreviewFrame { pub width: u32, pub height: u32, pub rgba: Vec<u8> }
  ```
  - 보내기/프록시 컴파일러는 호출하지 않는다.
  - 새 계획 문서를 이 Task 전에 쓴다. 이 파일만으로 Task 13 구현을 시작하지 않는다.

- [ ] **Task 14 — Program을 프레임 엔진에 연결**
  - 플레이헤드 이동 / 재생 헤드가 `frame_at`을 부른다.
  - 프록시 파이프는 폴백으로 남긴다 (엔진 실패 시 Phase 2).
  - 최종 보내기는 불변.

**Phase 3 성공 기준**

1. 플레이헤드를 드래그하면보내기 없이 합성 프레임이 갱신된다.
2. 갭은 검정, 클립 경계가 맞다 (1프레임 허용).
3.보내기 결과가 Phase 1 스모크와 같은 그래프를 쓴다.

---

## 10. 병렬 트랙 C — 툴박스 다듬기

NLE와 **별 명세**다. 페이지를 합치지 않는다는 결정 때문에, C는 각 도구 페이지를 살린 채 부품만 공유한다.

NLE Phase 1과 동시에 해도 안전하지만, **같은 PR에 넣지 않는다.**

| 순서 | 하는 일 | NLE와의 접점 |
|------|---------|--------------|
| C1 | 단독 도구에 “첫 프레임 / 짧은 미리보기” (지금 `export_frame` 또는 1초 encode). crop은 이미 있음. resize/watermark/fade부터. | 타임라인 컴파일러를 쓰지 않는다. |
| C2 | 입출력 경로 + `JobProgress` 반복을 작은 컴포넌트로. 페이지 라우트는 유지. | 타임라인 페이지는 이 셸을 쓰지 않아도 된다. |
| C3 | 폴더 일괄은 도구별로. 타임라인 일괄이 아니다. | 없음. |

C를 NLE보다 먼저 해도 된다. 그래프 컴파일러를 기다리지 않는다.

---

## 11. 이후 백로그 (이 계획에서 구현하지 않음)

- V2 오버레이 (`overlay=x:y:enable='between(t,s,e)'`). 모델은 N트랙이므로 validate/compiler만 풀면 된다.
- 트랜지션, 클립별 effects 채우기.
- 리플 삭제, 마그네틱, 스냅 to clip.
- 링크 A/V 분리(detach).
- 프로젝트 상대 경로 / 미디어 번들.
- GUI E2E.

---

## 12. 위험

| 위험 | 대응 |
|------|------|
| `filter_complex` concat이 해상도/fps/오디오 레이아웃 때문에 실패 | 모든 비디오 가지에 `fps,scale,pad,format`, 오디오에 `aresample,aformat`을 강제. 스모크가 다른 해상도 두 클립을 넣는다 (Task 4에 해상도 다른 픽스처 1쌍). |
| 무음 클립이 ffmpeg를 죽임 | 비디오 클립에 오디오 없으면 `anullsrc`. 기존 extract 회귀 메시지와 별개. |
| 긴 타임라인 프록시가 UI를 막음 | Phase 2는 잡 + 취소. Phase 1 UI는 프록시를 안 부른다. |
| 실시간 미리보기를 Phase 1에 섞음 | Task 12 전에 preview crate / WebCodecs 의존성 추가를 거절. |
| 도구 페이지와 타임라인이 빌더를 복제 | 타임라인은 `graph.rs`만. trim/concat 명령을 부르지 않음. |

---

## 13. 구현자가 쓸 명령

```bash
# Task 1–2
cargo test --manifest-path src-tauri/Cargo.toml timeline::

# Task 4
VIDEO_RS_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml smoke::timeline -- --test-threads=1 --nocapture

# 기존 회귀가 깨지지 않았는지
cargo test --manifest-path src-tauri/Cargo.toml
npm run build
```

`tauri:dev`에서 `/timeline`을 열어 Task 7을 손으로 확인한다. 브라우저 `npm run dev`만으로는 IPC가 없다.
