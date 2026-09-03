# Video RS — 배포·과금·사업화 계획 (데스크톱 먼저, 얇은 클라우드 나중)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Phase 1(설치 파일이 다른 기기에서 열림)을 만족하기 전에 결제·라이선스 게이트를 구현하지 않는다.** 영상을 서버에 올리는 인코더 SaaS는 이 계획의 범위가 아니다.

**Goal:** video-rs를 **이 기기에서 돌아가는 유료 데스크톱 제품**으로 판다. 툴박스는 유입(무료), 타임라인 NLE가 구독 이유다. 클라우드가 생기더라도 **영상 바이트는 올리지 않는다.** 계정·라이선스·프리셋·프로젝트 JSON만 동기화한다.

**Architecture:** 실행 엔진은 지금과 같다 (Tauri + 로컬 FFmpeg 사이드카 + `JobRegistry`). 과금은 앱 안의 **권한(entitlement)** 한 층이다. 오프라인 서명 라이선스 파일을 먼저 두고, 나중에 같은 형식을 얇은 라이선스 서버가 발급한다. 인코딩 IPC를 HTTP로 옮기지 않는다.

**Tech Stack (구현 시):** 기존 Tauri/Next, 정적 FFmpeg([plan-static-ffmpeg.md](./plan-static-ffmpeg.md)), Apple/Windows 서명([signing.md](./signing.md)), 오프라인 라이선스(서명된 JSON/JWT 파일). 결제·계정 공급자는 Phase 2 착수 전에 오너가 고른다. 영상 오브젝트 스토리지는 넣지 않는다.

**Spec:** 이 문서가 사업·배포 트랙의 구현 명세다. 앱 동작은 [spec_v0.1.0.md](./spec_v0.1.0.md)를 따른다. NLE는 [plan-nle.md](./plan-nle.md), YouTube는 [plan-youtube-download.md](./plan-youtube-download.md), 릴리스 사이드카는 [plan-static-ffmpeg.md](./plan-static-ffmpeg.md).

## 잠근 제품 결정

대화에서 고정한 값이다. 구현 중 바꾸려면 이 절을 먼저 고친다.

| 결정 | 값 |
|------|-----|
| 1차 상품 | **유료 데스크톱 앱.** 업로드형 클라우드 인코더가 아니다. |
| 무료 | 툴박스 16페이지 + 뷰어 + 분석 + Jobs + (선택) 유튜브 받기. |
| 유료 | `/timeline` 보내기(및 Phase 2 프록시 렌더). 나중에 팀 좌석·프리셋 동기화. |
| 유튜브 | **판매 훅이 아니다.** 쿠키/로그인 없음. 유료 빌드에 yt-dlp를 묶지 않는다. PATH/사용자가 설치한 바이너리만. |
| 클라우드 (나중) | 라이선스 발급, 프리셋, `.video-rs.json` 동기화. **영상·프록시·보내기 산출물 업로드 금지.** |
| 과금 형태 | 개인은 **구독**(월/연)을 기본으로 한다. 일시불만으로 닫지 않는다. 팀 좌석은 Phase 3. |
| 파일 | 지금과 같이 이 기기에만 있다. 서버는 경로를 모른다. |
| 기존 도구 IPC | 바꾸지 않는다. 게이트는 명령 앞의 권한 검사 한 곳. |
| 듀얼 UI | 툴박스와 NLE를 합치지 않는다 ([plan-nle.md](./plan-nle.md)와 동일). |

이 제품은 **로컬 도구**다. DRM 우회, 쿠키 추출, 유튜브 우회 로그인, 클라우드에서 유튜브를 대신 받는 기능은 구현하지 않는다.

---

## Global Constraints

- Next.js 16 static export + Tauri v2. 브라우저 `npm run dev`는 IPC가 없다.
- 인자는 **snake_case**. `Option<T>`는 IPC에서 `null`.
- 새 인코딩 빌더를 `services/ffmpeg.rs`에 넣지 않는다.
- `FFmpegService::run` / `JobRegistry` / `ffmpeg-progress` / `cancel_job` / `useFfmpegJob`를 재사용한다. 두 번째 잡 시스템·클라우드 잡 큐를 만들지 않는다.
- 기본 `cargo test`는 네트워크·결제 공급자 없이 통과한다. 실제 카드 결제는 CI 기본 잡에 넣지 않는다.
- Playwright / 프론트 테스트 러너는 이 계획에서 도입하지 않는다.
- 기존 도구 IPC 시그니처를 바꾸지 않는다.
- 영상 파일, 프록시 MP4, 보내기 산출물을 서버나 객체 저장소에 올리는 API를 만들지 않는다.
- yt-dlp를 `externalBin`에 넣거나 `--release` 핀으로 필수화하지 않는다 ([plan-youtube-download.md](./plan-youtube-download.md)와 동일).
- 정적 GPL FFmpeg 배포는 [plan-static-ffmpeg.md](./plan-static-ffmpeg.md)의 오너 수락 + 저장소 `LICENSE`가 있기 전에는 유료 설치 파일을 공개하지 않는다.

---

## 1. 왜 이 모델인가

video-rs의 약속은 두 줄이다.

1. 파일이 이 기기에만 있다.
2. FFmpeg는 이 기계에서 돈다 (사이드카, HW 인코더, 취소, Jobs).

브라우저에 영상을 올려 서버에서 인코딩하는 SaaS는 둘 다 깨뜨린다. 4K 전송·디스크·GPU 비용이 구독료를 넘기 쉽고, CapCut/Descript/Runway와 같은 시장으로 들어간다. 지금 코드(로컬 경로, `JobRegistry`, 타임라인 컴파일러)는 그 시장용이 아니다.

팔 수 있는 층:

| 층 | 내용 | 역할 |
|----|------|------|
| 툴박스 | 자르기·변환·크롭·자막 등 | 유입. 무료. |
| 타임라인 | 한 컴파일러, 프록시 미리보기 | 구독 이유. |
| 로컬 실행 | HW, 한국어 UI, 반출 없음 | B2B·공공의 이유. |

유튜브 받기는 쓰기 좋지만 YouTube 약관·yt-dlp 재배포가 유료 전면을 잡아먹는다. 무료 도구로 남긴다.

---

## 2. 목표 / 비목표

### Phase 0 — 팔 수 있는 설치 파일 (이 문서의 전제)

이미 있는 계획의 성공 기준을 **이 트랙의 진입 조건**으로 쓴다. 여기서 사이드카 스크립트를 다시 설계하지 않는다.

- [plan-static-ffmpeg.md](./plan-static-ffmpeg.md): `--release` 정적 GPL ffmpeg/ffprobe가 Homebrew 없이 다른 기기에서 실행.
- [signing.md](./signing.md) / [signing.kr.md](./signing.kr.md): Developer ID + 공증된 macOS 설치 파일. Windows는 별도 Authenticode 후속.
- 저장소 루트 `LICENSE`(또는 `LICENSE.txt`): 앱 코드 라이선스 + **번들 FFmpeg GPL 고지**. 정적 FFmpeg 계획의 “남은 작업 4번”.

Phase 0가 끝나기 전에 결제 UI·라이선스 게이트·랜딩 결제를 구현하지 않는다.

### Phase 1 — 권한 모델 + 오프라인 라이선스 (설치 파일이 생긴 뒤)

- 권한 한 곳: `entitlement` (`free` | `pro`).
- `free`: 툴박스·뷰어·유튜브 받기(yt-dlp가 있을 때).
- `pro`: `export_timeline`, `render_timeline_proxy`.
- 라이선스는 **서명된 파일**(기기 또는 사용자에 묶인 JSON/JWT). 일상 사용에 상시 온라인을 요구하지 않는다.
- 게이트는 Rust 명령 입구. 프론트만 숨기고 백엔드가 열어 두면 안 된다.
- 개발 빌드(`debug_assertions`)는 기본 `pro`. 릴리스는 파일 없으면 `free`.

### Phase 2 — 판매 경로

- 개인 구독 결제(공급자는 착수 전 오너 결정: 예 Stripe, Lemon Squeezy, Paddle — 이 문서가 공급자를 고정하지 않음).
- 결제 성공 → 라이선스 파일 발급 → 사용자가 앱에 넣음 (또는 나중에 계정으로 받음).
- 자동 업데이트 채널(Tauri updater)은 이 페이즈에서 **설계만** 해도 된다. 구현은 서명된 릴리스가 있을 때.

### Phase 3 — 얇은 클라우드 (영상 없음)

- 계정, 좌석, 라이선스 재발급.
- 프리셋(워터마크 기본값, 납품 해상도)과 `.video-rs.json` 동기화.
- 서버 스키마에 영상 경로·파일 바이트·프록시 경로를 두지 않는다.

### 전 페이즈 비목표

- 영상을 올리는 웹 인코더, 팀 렌더 팜, 클라우드 프록시.
- 서버가 유튜브를 대신 받기.
- 쿠키/로그인/DRM.
- 툴박스 페이지를 타임라인으로 합치기.
- 가격 숫자 고정 (오너가 Phase 2 전에 별도로 적는다).
- 앱 스토어 제출(Mac App Store / Microsoft Store) — 백로그. 1차는 직접 배포(DMG/MSI).

---

## 3. 현재 vs 목표

| 항목 | 현재 | Phase 0 | Phase 1 | Phase 2–3 |
|------|------|---------|---------|-----------|
| 설치 파일 | 빌드 Mac 전용, ad-hoc 서명 | 정적 FFmpeg + 공증 | 동일 | 업데이트 채널 |
| 과금 | 없음 | 없음 | 오프라인 라이선스 파일 | 결제 → 발급 |
| 타임라인 | 전원 사용 가능 | 동일 | `pro`만 보내기/프록시 | 동일 |
| 툴박스 | 전원 | 동일 | 무료 유지 | 동일 |
| 유튜브 | PATH/옵션 yt-dlp | 묶지 않음 | 무료, 번들 없음 | 동일 |
| 서버 | 없음 | 없음 | 없음 (서명 키는 오너 금고) | 계정·JSON만 |
| 파일 | 로컬 | 로컬 | 로컬 | 로컬 |

---

## 4. 권한과 게이트

```
Entitlement::Free | Entitlement::Pro
```

검사 위치 (한 모듈, 예: `src-tauri/src/services/license.rs`):

- `export_timeline` / `render_timeline_proxy` 진입 시 `Pro`가 아니면 `AppError::InvalidArgument` 또는 전용 `AppError::License` (`AppError`에 변형을 추가할 때는 기존 변형의 의미를 바꾸지 않는다).
- 툴박스 명령·`probe_download`·`download_video`·`validate_timeline`(편집 미리보기용)은 검사하지 않는다.
- 프론트는 같은 권한을 읽어 보내기 버튼을 막고, 문구 키 `license.*` (ko/en)를 보여 준다. **프론트 숨김만으로 만족하지 않는다.**

라이선스 파일 (초안, Phase 1에서 필드 확정):

```json
{
  "version": 1,
  "product": "video-rs",
  "tier": "pro",
  "expires_unix": 1770000000,
  "seat": "optional-machine-or-user-id",
  "sig": "<ed25519>"
}
```

- 검증 공개키는 앱에 심는다. 비밀키는 저장소에 넣지 않는다.
- 만료된 `pro`는 `free`로 떨어진다. 보내기만 막고 프로젝트 JSON은 연다.
- 기기 바인딩은 Phase 1에서 **선택**. 없으면 파일 복사로 공유된다. 남용되면 Phase 3 좌석에서 조인다.

개발:

- `VIDEO_RS_FORCE_TIER=free|pro` 환경 변수는 debug에서만. 릴리스 빌드는 무시.

---

## 5. 다른 계획과의 순서

```
plan-static-ffmpeg  ──┐
signing / notarize  ──┼── Phase 0 성공 ──► 이 문서 Phase 1 (게이트)
repo LICENSE        ──┘
plan-nle Phase 2    (프록시는 이미 main. Phase 3 스파이크는 구독 유지 이유, 이 문서와 병렬)
plan-youtube        (기능 유지. 유료 훅·번들 금지)
```

충돌 시:

- 사이드카·triple·`externalBin` → static FFmpeg 계획이 이김.
- 타임라인 미리보기 단계 → NLE 계획이 이김.
- 유튜브 URL 규칙·쿠키 금지 → YouTube 계획이 이김.
- “영상을 서버에 올릴까” → **이 문서가 이김. 올리지 않는다.**

---

## 6. 위험

| 위험 | 대응 |
|------|------|
| 설치 파일 없이 결제부터 | Phase 0 성공 기준 전에는 게이트/결제 구현 금지. |
| GPL FFmpeg를 유료 앱에 묶음 | `LICENSE`에 FFmpeg GPL 고지. 소스 제공 의무는 변호사 확인. 사이드카는 별 프로세스. 오너 수락 전 공개 유료 배포 금지. |
| 유튜브를 유료 전면에 | 금지. 번들하지 않음. 약관 리스크는 무료 도구로 한정. |
| 프론트만 잠금 | Rust 명령에서 거부. |
| 상시 온라인 라이선스 | Phase 1은 오프라인 파일. 서버 장애가 로컬 편집을 죽이지 않게. |
| 클라우드 인코더로 범위 확장 | 이 계획 비목표. 새 문서와 오너 결정 없이 구현 거절. |
| 가격·세금·스토어 수수료 | Phase 2 착수 전 오너가 공급자·가격을 `docs/plan-business.md` 잠근 결정 표에 한 줄로 추가. |

---

## 7. 작업 순서

### Phase 0 — 전제 (다른 문서)

- [ ] **Task 0a — 정적 FFmpeg**  
  [plan-static-ffmpeg.md](./plan-static-ffmpeg.md) 성공 기준. Homebrew 없는 기기에서 번들 ffmpeg가 `-version`과 기본 인코딩을 함.

- [ ] **Task 0b — 서명·공증**  
  [signing.md](./signing.md). 다른 Mac에서 Gatekeeper가 DMG/앱을 허용.

- [ ] **Task 0c — LICENSE**  
  앱 코드 라이선스 + 번들 FFmpeg GPL 고지. 정적 FFmpeg 계획과 중복 구현하지 말 것. 그 문서 Task를 여기서 체크만 한다.

**Phase 0 성공 기준**

1. 공증된(또는 Windows 서명된) 설치 파일을 Homebrew/apt ffmpeg 없는 기기에 풀어 툴박스 한 작업을 끝낸다.
2. 설치 파일에 yt-dlp가 **없다.**
3. `LICENSE`가 저장소에 있다.

### Phase 1 — 권한 + 오프라인 라이선스

- [x] **Task 1 — `Entitlement` + 단위 테스트**  
  생성: `services/license.rs`. 파일 파싱, 서명 검증, 만료, debug 강제 티어. 네트워크 없음.  
  커밋: `feat: add offline license entitlement`

- [x] **Task 2 — 게이트를 타임라인 보내기/프록시에만**  
  `export_timeline` / `render_timeline_proxy` 입구. 툴박스·유튜브는 통과.  
  커밋: `feat: require pro license for timeline render`

- [x] **Task 3 — UI**  
  라이선스 파일 불러오기, `free`일 때 타임라인 보내기 잠금, i18n ko/en. 결제 위젯 없음.  
  커밋: `feat: show license state on timeline`

**Phase 1 성공 기준**

1. 라이선스 없이 자르기/변환/유튜브(yt-dlp 있을 때)가 동작한다.
2. 라이선스 없이 타임라인 보내기·프록시가 Rust에서 거부된다.
3. 유효한 파일을 넣으면 보내기가 된다. 만료되면 다시 거부.
4. `cargo test`는 네트워크 없이 통과한다.

### Phase 2 — 판매 (오너가 공급자·가격을 잠근 뒤)

- [ ] **Task 4 — 결제 공급자 한 줄 잠금**  
  이 문서 잠근 결정 표에 공급자·가격·세금 처리(MoR 여부)를 적는다. 코드보다 문서가 먼저다.

- [ ] **Task 5 — 발급**  
  결제 후 서명된 라이선스 파일을 내려 준다. 앱은 Phase 1과 같은 검증만 한다.

- [ ] **Task 6 — 배포 페이지**  
  설치 파일 + 구독 CTA. 유튜브를 헤드라인으로 쓰지 않는다.

**Phase 2 성공 기준**

1. 카드(또는 공급자가 받는 수단)로 구독하면 라이선스 파일이 나온다.
2. 그 파일로 Phase 1 성공 기준 3이 재현된다.
3. 마케팅 문구가 “업로드 없음 / 로컬 FFmpeg / 타임라인”이지 “유튜브 다운로더”가 아니다.

### Phase 3 — 얇은 클라우드 (별도 착수)

- [ ] **Task 7 — 계정·좌석·재발급**  
  영상 버킷 없음. 라이선스 페이로드만.

- [ ] **Task 8 — 프리셋 + 프로젝트 JSON 동기화**  
  필드에 로컬 절대 경로가 있으면 동기화하지 않거나 기기별로 자른다. 소스 미디어는 각 기기에 있어야 한다.

**Phase 3 성공 기준**

1. 다른 기기에서 같은 계정으로 `pro`를 다시 받을 수 있다.
2. 서버 로그/DB에 영상 바이트가 없다.
3. 프로젝트 JSON을 받아도 없는 로컬 파일은 보내기 실패(지금과 같음).

---

## 8. 백로그 (이 계획에서 구현하지 않음)

- 클라우드 인코딩, 팀 렌더 팜, 브라우저 전용 편집.
- Mac App Store / Microsoft Store.
- yt-dlp `--release` 핀, 유튜브 로그인.
- 사이트 라이선스 영업 패키지 (NDA, 에어갭 키). Phase 3 이후 별 문서.
- NLE 미리보기 3 (실시간 스크럽) — [plan-nle.md](./plan-nle.md) Task 12+.
- 가격 A/B, 텔레메트리, 크래시 리포트 SaaS.

---

## 9. 구현자가 쓸 명령

Phase 0–1은 로컬만.

```bash
# 전제 (다른 계획)
npm run setup:sidecars -- --release
npm run tauri:build

# 게이트 단위
cargo test --manifest-path src-tauri/Cargo.toml license::

# 릴리스에서 무료 경로 손확인: 라이선스 파일 없이 툴박스 실행, 타임라인 보내기 거부
```

브라우저 `npm run dev`만으로는 라이선스 IPC가 없다.

---

## 10. 오너가 착수 전에 적을 것

구현자가 추측하지 않는다. 해당 Phase를 열기 전에 이 표를 채운다.

| 항목 | Phase | 값 (비어 있으면 그 Phase 구현 금지) |
|------|-------|--------------------------------------|
| GPL 정적 FFmpeg 유료 배포 수락 | 0 | 스크립트/`sidecar-lock.json`은 준비됨. 공개 유료 배포는 서명·LICENSE 후. |
| Apple Developer ID / 공증 시크릿 | 0 | |
| 앱 코드 라이선스 문구 | 0 | |
| 결제 공급자 | 2 | |
| 개인 월/연 가격 | 2 | |
| 세금·환불은 공급자 MoR인가 | 2 | |
| 계정 호스트(자체/Clerk 등) | 3 | |
