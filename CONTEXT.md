> 현재 프론트엔드는 React + Vite + React Router를 사용하며, 스타일은 Tailwind TS 토큰·variant·프리셋으로 관리합니다. `src/app/App.tsx`는 RouterProvider만 실행하고, 페이지는 `src/pages/`, 경로 설정은 `src/app/routes.tsx`와 `src/features/navigation/route-config.ts`, 공통 레이아웃은 `src/layouts/app-layout.tsx`에 있습니다. 실행 방법과 URL 예시는 README.md를 확인하세요. 아래는 전환 이전의 작업 이력입니다.

# Narackrock Frontend 작업 컨텍스트

## 1. 프로젝트 개요

- 제품: Narackrock/Adlips 음악 커뮤니티 웹 프론트엔드
- 현재 목표: Figma `v3`의 `Ready for dev` 디자인을 기준으로 모바일 웹을 우선 구현하고, 추후 API 연동 및 PWA 전환
- 프로젝트 경로: `/Users/kimmingun/narackrock/frontend`
- 로컬 미리보기: `http://localhost:5173/`
- GitHub: `https://github.com/Team-Glitched/narackrock_frontend_v2.git`

## 2. Figma 소스

- 팀: `Gliched`
- 폴더: `Narackrock`
- 파일: `Narackrock Design`
- 파일 URL: `https://www.figma.com/design/P04hhGubLPhK47pHaOpSyh/Narackrock-Design`
- 파일 키: `P04hhGubLPhK47pHaOpSyh`
- 접근 권한: View only
- 기준 버전: `v3`
- `v3` 섹션은 Figma에서 `Ready for dev` 상태로 확인됨
- Figma MCP 플러그인이 연결되어 있으며 `get_design_context`, `download_assets`를 사용해 디자인과 자산을 가져옴

### 구현 기준 프레임

| 화면 | Figma node ID | 기준 크기 |
| --- | --- | --- |
| Main | `9771:16491` | 390×844 |
| 인기차트 | `10756:18235` | 390×844 |
| 인기글 | `10757:18784` | 390×844 |
| Profile | `12803:20942` | 390×844 |
| Edit Profile | `12803:20950` | 390×844 |
| Friend | `10434:16458` | 390×844 |
| Search | `10766:19093` | 390×844 |
| Community | `10411:15680` | 390×844 |
| Making song (readonly) | `6779:12694` | 844×390 |
| Abyss | `8661:14568` | 390×844 |
| Note editor | `7643:13205` | 가로 작업 화면 |
| Studio ruler/playhead | `8018:14329` | 가로 작업 화면 상단 |

### 디자인 특성

- 기본 배경색: `#1d1d1d`
- 주요 포인트색: 보라색 계열 (`#4c00e5`, `#5b00f5`)
- 텍스트: 제목과 본문 모두 `Pretendard` (사용자 지시 우선)
- 모바일 기본 프레임은 390×844이며 하단 5개 내비게이션을 사용
- 곡 제작 화면은 844×390 가로 레이아웃
- 로고, 프로필 이미지, 내비게이션, 좋아요·댓글·공유 등 Figma 원본 자산은 `public/figma/`에 저장됨

## 3. 기술 구성

- Next.js 호환 Vinext 구조
- Next.js `16.2.6`
- React `19.2.6`
- TypeScript `5.9.3`
- Tailwind CSS `4.2.1`
- Vite/Vinext 기반 개발 및 Cloudflare Worker 호환 빌드
- Node.js 요구 버전: `>=22.13.0`

### 주요 명령어

```bash
npm install
npm run dev
npm run build
npm run lint
```

- 개발 서버 포트: `5173`
- 프로덕션 빌드 산출물: `dist/`

## 4. 현재 구현 구조

### 주요 파일

- `src/app/page.tsx`: 화면 조합과 최상위 화면 전환
- `src/app/globals.css`: Figma 기준 모바일/가로 작업 화면 스타일
- `src/app/layout.tsx`: 한국어 문서 설정 및 사이트 메타데이터
- `src/app/manifest.ts`: 향후 PWA 전환을 위한 웹 앱 매니페스트
- `src/components/app/`: 앱 셸과 공통 UI 구성요소
- `src/components/app/shared.tsx`: 헤더, 푸터, 아바타, 곡 레일 등 공통 UI
- `src/features/navigation/types.ts`: 화면 식별자와 이동 함수 타입
- `src/features/screens/`: 모바일 화면과 스튜디오 화면 컴포넌트
- `src/features/screens/mobile-screens.tsx`: 홈, 차트, 게시글, 어비스, 친구, 검색, 커뮤니티, 프로필 화면
- `src/features/screens/studio-screens.tsx`: 타임라인과 노트 편집 화면
- `src/hooks/use-webmcp-navigation.ts`: 브라우저 코멘트 기반 화면 전환 도구 등록
- `src/lib/api/`: 별도 백엔드 API 계약 및 공통 요청 클라이언트
- `src/lib/adlips-data.ts`: API 연결 전 목 데이터/타입
- `public/figma/`: Figma에서 다운로드한 원본 PNG/SVG 자산
- `.openai/hosting.json`: OpenAI Sites 프로젝트 연결 정보

### 구현된 화면 상태

`src/app/page.tsx`의 `View` 상태로 아래 화면을 전환한다.

- `home`: 인기 곡, 인기 글, 내 곡
- `charts`: 인기차트 목록
- `posts`: 인기글 목록
- `friends`: 팔로우 추천 및 팔로우 요청
- `search`: 검색 입력 및 임시 빈 결과
- `community`: 게시글/커뮤니티 탭과 게시글 피드
- `profile`: 프로필, 통계, 악기 태그, 설명, 작업물
- `edit`: 프로필 사진 및 입력 필드 편집 화면
- `studio`: 가로형 곡 제작 타임라인
- `abyss`: 어비스 곡 목록
- `noteEditor`: 선택한 레이어의 노트 편집 화면

화면 전환은 아직 URL 라우팅이 아니라 단일 페이지 내부 상태로 동작한다. 하단 내비게이션, 검색, 프로필, 모두보기 버튼과 WebMCP 도구가 같은 상태를 변경한다.

### 현재 임시 인터랙션

- 하단 내비게이션 화면 이동
- 인기 곡/인기 글의 `모두보기` 이동
- 헤더 검색 및 프로필 이동
- 검색어 입력/초기화
- 팔로우/맞팔로우 상태 변경
- 팔로우 요청 확인/취소
- 커뮤니티 탭 변경 및 좋아요 토글
- 프로필 이미지 클릭 시 편집 화면 이동
- 곡 제작 화면 재생 상태 토글
- 하단 `어비스` 버튼에서 Figma `8661:14568` 기준 화면으로 이동
- 스튜디오 레이어 버튼에서 Figma `7643:13205` 기준 노트 편집 화면으로 이동
- 재생 버튼을 누르면 Figma `8018:14329` 기준 흰색 재생 헤드가 오른쪽으로 이동
- 재생 헤드를 직접 드래그해 타임라인 위치 변경
- 룰러 영역은 화면 상단에 고정하고 레이어 목록은 상하 스크롤 지원
- 긴 레이어와 타임라인은 좌우 스크롤 지원
- 게시글 이미지와 곡 커버는 API 연결 전까지 Figma 임시 이미지로 채움
- WebMCP 도구: `navigate_narackrock_view`

## 5. 아직 연결되지 않은 기능

- 백엔드 API 및 실제 데이터
- 인증/로그인 및 사용자 세션
- 영구 저장소와 서버 상태 관리
- 실제 검색 결과
- 음원 재생, 녹음, 믹싱 및 타임라인 편집 엔진
- 이미지 업로드
- 알림
- 화면별 URL 라우팅/딥링크
- 서비스 워커, 오프라인 캐시, 설치 프롬프트 등 완전한 PWA 기능

현재 `manifest.ts`만 준비되어 있으므로 PWA 전환 시 서비스 워커와 캐시 전략을 별도로 추가해야 한다.

## 6. 향후 API 연동 권장 방향

- 백엔드 주소는 `NEXT_PUBLIC_API_BASE_URL` 환경 변수로 설정
- `src/lib/api/client.ts`의 `apiRequest<T>`를 공통 HTTP 진입점으로 사용
- 쿠키 기반 인증을 고려해 요청 기본값에 `credentials: "include"` 적용
- 서버 문서를 받은 뒤 `src/lib/adlips-data.ts`의 목 데이터를 `src/lib/api/contracts.ts` 기반 API 응답으로 교체
- 화면별 데이터 패칭 로직을 UI 컴포넌트에서 분리
- 사용자 액션은 낙관적 업데이트와 실패 복구 상태를 함께 설계
- 인증 방식이 확정되면 보호 화면 및 토큰/세션 처리 추가
- 곡 제작 API는 일반 CRUD API와 오디오 업로드/스트리밍 계약을 분리해 설계
- API 연동 전에 단일 `View` 상태를 Next.js 라우트 구조로 이전할지 결정

## 7. 검증 상태

- Figma MCP 스크린샷과 로컬 390×844 화면을 비교해 주요 간격과 자산을 보정함
- 곡 제작 화면은 844×390 기준으로 비교함
- `npm run build` 성공
- `npm run lint` 성공
- 브라우저 콘솔 오류/경고 없음
- 로컬 미리보기는 `npm run dev`로 실행 가능

## 8. Git 상태

- 브랜치: `main`
- 원격: `origin` → `https://github.com/Team-Glitched/narackrock_frontend_v2.git`
- 기준 구현 커밋: `698f31c` (`refactor: reorganize frontend and enhance interactions`)
- 해당 커밋에는 화면 구현, 인터랙션 보정, 임시 이미지 및 `src/` 구조 리팩토링이 포함됨
- 이 문서 갱신 후 `origin/main`에 함께 푸시 예정

## 9. 배포 상태

- OpenAI Sites 프로젝트 ID가 `.openai/hosting.json`에 등록되어 있음
- Sites 배포는 아직 진행하지 않음
- GitHub 소스 업로드와 Sites 배포는 별도 절차로 취급

## 10. 작업 시 주의사항

- Figma 기준은 반드시 `v3`의 `Ready for dev` 프레임만 사용
- 기존 Figma 원본 자산을 우선 재사용하고 임의 아이콘으로 대체하지 않기
- 390×844 모바일 레이아웃과 844×390 작업 화면의 치수를 우선 보존
- API 문서가 오기 전에는 목 데이터 구조를 과도하게 확장하지 않기
- 별도 백엔드가 존재하므로 프런트엔드에 신규 데이터베이스 로직을 추가하지 않기
- 화면 컴포넌트에서 직접 HTTP 요청을 만들지 말고 `src/lib/api/` 경계를 사용하기
- 사용자 요청 없이 인증, 데이터베이스, 소셜 공유 이미지 또는 완전한 PWA 기능을 선행 구현하지 않기
- `.openai/hosting.json`의 프로젝트 ID를 임의로 교체하거나 새 Sites 프로젝트를 중복 생성하지 않기


## 최종 검토 — 2026-10-12

이 기록은 위의 초기 저장소 컨텍스트보다 최신이다. Figma V3가 모든 UI의 최우선 기준이다.

- 일반 캔버스 390×844, 편집 캔버스 844×390. 전체 캔버스를 같은 비율로 축소하며 아이콘별 비율을 임의로 변경하지 않는다.
- 기본 토큰: 배경 #1d1d1d, 본문 #f2f4f6, 보조 글자 #aab6c2, 포인트 #4c00e5, 표면 #2c3238. 폰트는 모든 화면 Pretendard.
- 홈, 차트, 인기글, 친구, 커뮤니티 목록·가입 목록, 프로필·편집, 검색, 오픈소스 목록·상세, 설정, Saved, 서비스 관리자·커뮤니티 관리자, 로그인, 제작 방식 선택, 업로드, 녹음 화면을 브라우저에서 열어 점검했다.
- 미리보기에서 새 곡 생성 → 피아노롤 → 노트 설정 → 저장 → 재열기 → 재생 → 게시 확인 → 음원 생성 → 생성된 숏폼 재생을 검증했다.
- 참여자 390×721, 트랙 음량 350×163, 노트 설정 350×362 팝업을 원본에 맞추고 연결했다. 노트 길이·음량은 노트 데이터에 반영한다.
- 알림과 댓글은 하단 시트이며, 알림을 닫으면 이전 화면을 유지한다. 게시글 상세는 하단 메뉴 대신 댓글 작성창을 사용한다.
- 친구 카드 레일 누락, 오픈소스 카드 색상·테두리, 로그인 문구·구조, 업로드·녹음 원본 아이콘, 댓글 버튼 투명도와 제작 뒤로가기 연결을 교정했다.
- 미리보기 데이터는 /preview에서만 사용하며, 댓글·답글을 게시글별로 분리하고 수정·삭제를 지원한다.
- 검사: 테스트 35개 통과, ESLint 오류·경고 없음, TypeScript 검사 통과, 프로덕션 빌드 성공. 확인한 브라우저 콘솔 오류 없음.

### 완료 판정의 한계

전체 기능을 완벽하게 완료했다고 판정할 수 없다.

- 실제 Google 로그인은 NEXT_PUBLIC_GOOGLE_CLIENT_ID 설정이 없어 검증 불가. 로그인·회원가입 디자인은 같은 기존 Google 인증 API를 사용한다.
- 실제 검색 결과 API가 연결되지 않아 검색 입력 화면만 구현돼 있다.
- 숏폼 댓글, 팔로우, 채팅, 오픈소스 상호작용에는 로컬 미리보기/예시 데이터가 남아 있으며 실제 서버 기능으로 완료됐다고 보고하지 않는다.
- 노트의 울림 및 임시 효과는 디자인의 '일단 효과'처럼 동작 사양이 확정되지 않았다. 해당 슬라이더는 비활성 상태이며 음량·길이만 동작한다.
- 마이크 권한 사용 및 실제 서버 녹음→MIDI 변환은 실행 검증하지 않았다.
- 관리자 화면은 사용자 요청에 따라 UI 미리보기이며 실제 허가·정지·추방 처리를 하지 않는다. 커뮤니티 생성자와 로그인 사용자 ID를 비교해 관리 진입을 표시한다.
- 실기기 전체 조합, 모든 이미지 업로드 조합과 모든 화면·팝업의 픽셀 단위 동일성은 확정하지 않았다. 검증한 화면·동작 범위를 넘어 완벽함을 주장하지 않는다.

## 2026-10-12: User-reported UI inconsistencies and prototype actions

- Figma remains the UI source of truth. Compared the social/community/friends prototype through computer use and read the piano/timeline reactions through Figma MCP (UI page 1501:266).
- Removed the social feed's bottom compose button and post-menu compose action. Community detail retains its separate composer. Other users' posts no longer expose owner edit/delete actions.
- Profile navigation now accepts the requested user ID. Post/comment authors, friends, open source authors and Abyss authors resolve the target profile; header navigation resets to the signed-in profile. The preview adapter resolves IDs 1/2/3 separately. Public profiles cannot open the own-profile editor or settings. Added an identity-isolation regression test.
- Community/friends top padding is consistently 30px per the user's requested correction. The Figma friends frame itself has a 10px difference; this shared padding deliberately follows the user's specific correction.
- Comment send icons use their original 22px SVG roots inside centered 32px buttons, without padding-induced offset. Open-source input now uses the same plus/input/send layout. Search uses the original 13px exported close SVG in a centered 30px target, including the empty state.
- Open-source comment reporting opens the original report sheet and no longer removes the comment. Reporting has no server submission API.
- Popular posts and charts now have the measured back/action header, original typography and row layout. Chart artwork is 90×90, row gap 30px. Popular-post rows have 90px images, 40px gaps and body excerpts. Both use the proper popular data ordering; popular posts support infinite pagination. Narrow browser CSS no longer reduces these fixed-canvas paddings. These list frames use the off footer variants shown in Figma.
- Abyss comment/share icons now use original exports at their intrinsic sizes; other reaction variants remain original SVG roots. The title #EDE6FC is the Figma primary/100 color, intentionally different from the white text. Typography uses Pretendard despite the source title's Paperlogy style.
- Piano roll has no invented top ruler or corner frame. Grid starts at y=0 below the 44px toolbar; keyboard labels removed to match source. Removed bottom length/save tools; length is edited through the note popup and notes save on leaving the editor.
- Actual piano prototype reactions: the purple switch opens Instrument Picker (13507:31842 / 15026:34578), the right + saves and returns to the review timeline (13488:30801 / 15026:34523); the review timeline + opens Publish Confirmation (13488:31624 / 15026:34550). Empty timeline + opens creation choices. Clip click opens MIDI Track Settings; double-click retains MIDI editing without adding UI controls.
- Empty timeline preserves the full grid, 98px left column and 25px #7D8FA1 ruler, with original 20px columns and four-column ticks. Saved tracks overlay the continuing grid.
- Measured V3 dialogs now portal into the scaled design canvas, rather than using unscaled browser top-layer dialogs. Note settings 350×362, instrument 350×83, volume 350×100, track settings 350×163. Overlay matches Figma 25% black, closes outside/Escape, traps keyboard focus and restores it.
- Added the missing BPM and beat popups (15098:39655/39669), and connected the metronome to the actual playback clock. Preview BPM changes affect playback and persist with the preview project. Real-server BPM and beat mutation has no API contract, so the real-server BPM control is read-only and beat displays 4/4. Note reverb/effect controls remain disabled until their actual playback/API behavior is implemented; do not claim full completion of those functions.
- Browser verification: other profile -> own profile; popular posts/charts navigation and 90px chart art; both top paddings 30px; search X and send centers within rounding error; open-source report preserves comments; empty timeline; BPM 120->121; note insertion and settings; 844×390 logical canvas / 350×362 note dialog; note save -> timeline -> publish popup. Tested entirely in /preview. No live report/publication submitted.
- Final checks: 36 tests passed, TypeScript passed, lint clean, production build passed, git diff --check clean. Snapshot: /Users/kimmingun/.codex/visualizations/2026/10/11/01a12c71-b5e3-7ef0-9db4-1698e208f381/narackrock-ui-fixes.png.

## 2026-10-12: Contextual search/create and shared comments

- Fixed the social author identity width: its button no longer inherits the 40px more-button constraint. Removed the community-detail inline search/sort and extra compose button; footer + is the entry point.
- Header search retains its originating screen and selects posts / communities / people / songs / sources accordingly. Search clears detail overlays and restores the originating community/post on back. Empty search matches the prototype without result tabs; result tabs appear after typing. Post results query the gallery APIs, community results filter gallery data, song results currently filter the loaded shorts page, people derive from loaded post authors, source search uses preview source data. No dedicated server-wide people/source search API exists.
- Footer + opens post creation in posts/community detail, community creation in community directory, people search in friends, source creation in open source, composition elsewhere. Post creation includes the Figma header community selector and passes the selected gallery ID to the existing create API.
- Community/source creation works locally in /preview. Production shows an explicit missing-server-API message. Preview communities retain ownerId=1 and are joined on creation. Preview post filtering now respects gallery ID, and new posts start with zero reactions/comments.
- `features/comments/common-comments.tsx` now owns every comment row, composer, reply count, expand/collapse, pagination, reply targeting, edit/delete menu and report UI. Post adapter keeps existing backend contracts. Abyss/source adapters are preview-local and isolate stores by song/source ID. Do not describe preview reactions, reports, Abyss/source comments, or creation as implemented production endpoints.
- Browser verified: posts vs communities search scope; community creation -> post creation in that community -> comment -> reply; Abyss expand 12 replies -> load remaining 2 -> collapse -> create reply; source common reply creation. Original exported SVG sizes retained and common input/send alignment used. Screenshot: /tmp/narackrock-common-comments.jpg.
- Verification: TypeScript, lint, production build passed; 38 automated tests passed, including reply pagination, root counts, entity isolation, ownership and child deletion. The onboarding source-pattern test was adjusted to allow the new create-screen footer exclusion while retaining the onboarding guard.

## 2026-10-13: Measured Home / Shorts / Social visual correction

- Re-read Figma design context and screenshots for Home 9771:16491, Shorts 8661:14568, Social 10411:15680; inspected actual nested instance dimensions and variants. Also viewed the Shorts prototype through computer use.
- Home now matches the source section heights (234 / 364), section gap 60, 30px top padding, 206px song rail, 92px compact rows with 30px between them. Section headings are 20px Bold, song titles 16px Bold, compact body 14px Medium. Home comment icon now uses the correct 13.5px muted source SVG instead of shrinking the social 17.5px white icon.
- Removed conflicting social border rules from community.css and corrected the action-bar selector that accidentally gave the nested dislike button a 36px width. Social tabs stay fixed while the feed scrolls; list starts at y104, cards are 424px with gap30, image350x262 radius4, heading18/600/21, action bar26px with border0.
- Introduced explicit Figma layout slots around intrinsic SVGs: miniature12, post16, short18, save12x16 /14x20, navigation28x20. SVG paint bounds include stroke overflow and are never stretched to the slot. Exported actual 18px and16px icon instances and selected variants (temporary clones removed in the same call) to retain native stroke weights and prevent on/off size changes. Header bell/search replaced with current #F2F4F6 source exports; footer label weight500 and color#F2F4F6 restored.
- Shorts: view padding16/20/40, cover slot320 with300px cover at(45,90), title block y410, action bar y497.2/h35, progress y564, transport y589/h82, join y696/h44. Player/join bottom stack preserves the source spacing. Restored horizontal overflow of the action bar and the source report button opening the existing report sheet; no server report submission added.
- Browser verified all visible image loads, Pretendard font loaded, both post/short vote variant dimensions stable, social action borders0, correct measured card/section gaps. Existing38 tests, TypeScript, lint and production build passed. Proof images in the task visualization directory: home-spacing-fixed.jpg, social-spacing-fixed.jpg, shorts-spacing-fixed.jpg.

## 2026-10-13: Explicit user overrides for Shorts and shared open-source reactions

- User explicitly overrides the source's pastel title color and mixed reaction sizes: Shorts title is now neutral white #F2F4F6, all reaction counts16px/500, reaction pill heights32px, artwork max dimension20px with aspect ratio preserved. Share/bookmark/report SVGs are uniformly scaled by20/22 inside20px slots; root attributes remain intact.
- Carousel album gap changed20->60 and step320->360 together. Current300px image remains centered; adjacent albums have zero intersection with the350px viewport at rest. Verified next and previous navigation.
- Extracted `components/app/post-actions.tsx` and its isolated CSS from CommunityPost and reused it for both open-source list (compact) and detail. Votes, comments, and save use the same original SVG variants,26px pills,14px/500 labels and border0 across these screens. Existing callbacks preserved; no new production reaction API claimed.
- Browser compared community/open-source computed sizes and verified source like and comment navigation. TypeScript,38 tests, lint and production build passed. Proof: shorts-uniform-final.jpg and opensource-shared-actions.jpg in the task visualization directory.

## 2026-10-13: Comment reaction variants and read-only gray statistics

- CommonComments now changes the actual Figma Like/Dislike variant when pressed, keeping number text #F2F4F6. Removed the purple aria-pressed text rule. Exported14px source instances in both states into native16px SVG bounds, preserving variant dimensions and stroke weights; no recolored generic icons.
- MiniPost gray metadata icons are read-only. Clicking statistics stops propagation to the surrounding post card and uses the default cursor, with no standalone interactive semantics. Actual post body/title navigation remains available.
- Verified Shorts and open-source comments: both active icons use their on SVG while computed text color stays rgb(242,244,246). Clicking gray Home statistics kept Home visible. TypeScript, lint,38 tests and production build passed. Screenshot: comment-variant-only.jpg in task visualization directory.

## 2026-10-13: Search, post-user menu, and open-source statistics

- User corrected their initial concern about audio input: leave Open Source creation unchanged, including required audio. Confirmed unchanged in browser. Actual song metadata form now says 앨범 추가 instead of 사진 추가; no audio picker in that form.
- Re-read Figma context/screenshots for Search10766:19093, Menu / Post User Actions15236:41267 and Open Source Feed11702:20688. Search input is neutral950#2C3238,320x36, with44px back target and original source Back/Search SVGs. Browser verified background rgb44/50/56 and return to originating screen.
- Other users' post options are no longer disabled: opens260x99 Figma menu with 신고 and 숨기기. Report opens existing report-reasons sheet (no server report submission). Hide removes the current rendered card locally; resets when the feed remounts. Existing owner edit/delete entry retained.
- Source feed gray stats were confirmed as read-only in Figma. Added a readOnly mode to shared PostActions, rendering only spans/native muted12px icons and counts, with no buttons or click handlers. Actual source detail still has white interactive controls. Clicking source stats leaves the feed unchanged.
- Source body-to-footer gap is now26px (previous14). Source detail copy has26px below it before media. Verified no missing image assets.
- TypeScript,lint,38 tests,production build and diff whitespace checks passed. Browser verified menu -> report, menu -> hide (6 cards ->5), search back, source read-only behavior, untouched source creation, song album label. Screenshot: post-user-actions-menu.jpg in task visualization directory.

## 2026-10-13: User-approved reversible typography trial

- User authorized readability adjustments and asked to preserve the prior version. Saved all prior src files to /Users/kimmingun/narackrock/backups/typography-before-2026-10-13.tar.gz. Rollback: remove the readability.css import in layout.tsx; prior style files remain unchanged. Details: backups/typography-trial.md.
- New readability.css: common comment and open-source body14px/21px; preview body14px/20px; metadata12px/16px; footer10px/12px. Body text remains400, author names500; source body now neutral100 rather than muted. Compact rows accommodate96px, and source cards use natural height.
- CSS comment selectors include the nr-comments root to win over dynamically loaded base styles. Verified actual font sizes after opening source comments and Shorts comments, not only stylesheet declarations. Measured main rows96px with no overflow; source card no overflow; reply expansion works. Comment votes still change only the SVG variant, maintaining neutral100 text.
- TypeScript,lint,38 tests,production build and whitespace checks passed. Screenshot: typography-trial-comments.jpg in task visualization directory. Figma source file was not modified; this is an explicitly approved frontend typography experiment.

## 2026-10-13: Compact-post thumbnail alignment

- User requested enlarging the thumbnail because the typography trial's text column extended below the90px image. In readability.css only, enlarged thumbnails to96x96 and made the adjacent column fill the remaining234px (350px row minus96px image minus20px gap). Preserves14px preview typography and96px row height.
- Browser measured all three Home rows: image/text top and bottom differences0px. Production build and diff whitespace checks passed. Screenshot thumbnail-text-aligned.jpg in task visualization directory. Removing the trial import still restores the original90px layout.

## 2026-10-22 Missing-page frontend flow
- Added workspace, submission list/detail, review inbox/detail, version list/detail, source library and source import/target selection screens using existing Figma colors/assets/Pretendard/card + sheet patterns.
- Added song information/part selection sheet before joining; new-project form accepts concept/recruiting instruments/headcount. Those extra fields are browser-local, not new backend contracts.
- Workspace/submission snapshots, preserved resources and local version history are scoped to preview/live + user in browser storage. Example submissions/resources/versions exist only in /preview. Live review controls on these new local pages are disabled; existing notification review API remains available.
- MIDI resources import into actual selected project using existing track/clip APIs, with permission, participant-layer count, PPQ conversion and song duration checks. Audio-resource import remains unsupported. New library is for captured MIDI layers, not a replacement for the existing source feed backend.
- Entry points: profile, settings, source feed, studio, layer-choice screen and preview quick navigation.
- Verified: rejected submission -> preserve -> library; review solo/mix playback -> approve; new song -> import preserved MIDI -> studio -> workspace. Approval creates a new snapshot without mutating the original/pending draft (2 tests); existing + new tests passed 40/40.

## 2026-10-22 Revised scope (supersedes missing-page additions above)
- User removed version history and recruitment headcount/instrument features. Removed version routes/screens/store/history tests and recruitment form/sheet/part selection. Existing API concurrency `project.version` remains an internal contract only.
- Removed new profile/workspace/source-feed/studio/choice shortcuts; collections are reached through settings. Preview shortcut list no longer exposes them. Studio visual composition is restored; the requested MIDI import + is beside BPM.
- MIDI measured against Figma 7643:13205 (844x390), toolbar 44 high, left gutter29, keyboard87, row30, cell20. Aligned scroll start to complete rows; restored 58x30 black keys, 28px note height and 80px measure grid. MIDI import now appends to the current owned MIDI clip, preserving notes and validating song duration, then returns to the editor.
- Icon / Edit Profile 12803:20957 is an outlined input with Neutral950 border (not filled background); applied to matching edit/create form fields.
- Profile Follower/Following/Articles counts now open sheets. Articles reuse MiniPost and filter fetched post details by writer userId. Followers/following preview uses explicitly labeled example users; live profile contract currently exposes counts only, so missing list data shows a connection-needed message rather than invented users/routes.
- Notifications now use avatar + concise copy, incoming requests, own statuses, rejected-part conversion to locally preserved resource. Existing server inbox approval actions preserved.
- Source creation audio now follows upload/record choice, excluding piano roll and MIDI conversion. Header back traverses audio stages and preserves metadata.

## 2026-10-22 Overall polish pass
- Audited Home, social/community, source list/detail, Shorts vote states, source creation/audio choices, profile sheets, notifications, settings and the landscape studio/MIDI flow in browser. Preserved the established design and removed-feature scope.
- Added a minimum 30px separation between creation fields and submit controls so album/media pickers cannot touch the submit button. Source image label now says album. File selection resets its input so the same file can be selected again after an error.
- Isolated create-form, submission-detail, source-library mode and MIDI editor component state by identity; reentering source creation starts at metadata rather than a stale audio stage.
- Library preview now displays the matching pause state, uses compact stable-width labels, handles playback failures and stops another library preview on play. Shared audible-duration calculation keeps its seek range aligned with MIDI/audio/solo/mute playback; added three behavioral tests (41 total).
- Profile sheets no longer refocus after every parent render; profile/notification dialogs contain Tab focus and Escape returns to the opener. Expanded profile song lists show collapse wording. Clearing search restores input focus; library search trims whitespace and includes descriptions.
- MIDI direct-entry without a selected layer now explains the prerequisite instead of showing perpetual loading. No composition layout changes; verified 844x390 canvas and 44px toolbar.

## 2026-10-22 Timeline lane alignment correction
- User supplied studio screenshot highlighting inconsistent lanes/cells. Re-fetched Figma 6779:12694 and high-fidelity children 13433:27931 (grid), 13433:27030 (layer), 13433:29030 (ruler), 7634:12895 (clip), 8008:14079 (toolbar). Reference: row pitch46 = bordered42 + gap4, content/clip40, step20, sidebar98, ruler25.
- Root issue: populated-track backgrounds and bottom-anchored empty-grid gradients had different vertical phases. Consolidated timeline rules into studio-timeline.css; one top-anchored grid now backs every populated/empty lane, with transparent track containers. Removed redundant V3 timeline overrides.
- Track colors now use trackIndex rather than nth-child among ruler/playhead/background siblings (red/green/blue per reference). Clip widths and offsets continue using actual composition timing.
- Added sticky sidebar fill across empty rows, sticky ruler/corner, and hidden native scrollbars while keeping both-axis scrolling. At rest at zero, no white playhead obscures the first column.
- Browser measured rows46, clips40 at top inset1, row origins0/46/92, ruler25, every step20; verified horizontal scroll1280 preserves sidebar position and masks empty grid beneath it. All visible existing image assets loaded. Proof: timeline-grid-aligned.jpg in the task visualization directory.

## 2026-10-22 Post hide navigation
- Post detail previously hid only its header, leaving a comments-only screen. Hiding now records the post in shared account/preview-scoped browser storage and immediately clears the detail route, restoring its previous Home/social/community/search/profile/saved context.
- The same hidden-post state filters gallery lists and shared MiniPost/CommunityPost cards, plus Saved, so hidden items stay absent after navigating back or reloading. Server pagination progression continues to use unfiltered loaded pages/counts.
- Browser verified hiding post1 from Home detail returns Home with no comments screen and visible IDs2/3/4; social IDs2/3/4/5/6 exclude the same item. Existing comments/replies are not individually removed.

## 2026-10-22 Settings organization and interface wording
- Replaced temporary outlined settings cards with grouped, full-width navigation rows: Account, Music/Participation, Library, Service Information. Existing destinations only; privacy links to existing /privacy. Removed the development preview link from settings (corner preview navigator remains). Kept Pretendard, neutral950 separators/pressed state, shared white/muted text.
- Profile editing tracks its entry screen. Settings -> Edit -> Back or Save returns Settings; Profile -> Edit -> Back returns Profile. Onboarding still uses its original authentication flow. Removed the self-linking settings gear from Settings itself.
- Centralized shared UI headings in lib/ui-labels.ts: 제작한 음악, 대표 음악, 참여한 음악, 인기 게시글, 작업 중인 음악, 보낸 참여 요청, 받은 참여 요청, 저장한 콘텐츠, 오픈소스 보관함, 제작한/저장한 레이어. Profile counters and introduction are Korean. User-supplied song/post titles are unchanged. Saved now has a proper page heading and uses 게시글 consistently.
- Verified settings layout and Back/Save entry-aware behavior with browser interactions, plus saved/profile title displays. TypeScript/lint, 41 tests and production build passed. Proof: settings-grouped-polished.jpg in task visualization directory.

## 2026-10-22 Supporting-copy spacing
- User requested breathing room around small secondary text, especially follower-sheet example notice. Added shared 8px supporting-copy and 24px footnote spacing to the approved readability stylesheet.
- Applied to profile/follower names and instrument labels, participants, settings row descriptions, chart metadata, friends, community member counts, source metadata, notifications, saved music and administrative identity rows. Existing larger gaps remain intact; studio/MIDI controls untouched.
- Follower rows now min48 with24px row gaps, and the example notice has24px top margin. Home rails grow to accommodate the new metadata gap; fixed-height friend cards/rows allow adequate content height.
- Browser confirmed follower name gap8/footer24, settings descriptions8 and source metadata8. Home card metadata remains within its card. Production build and whitespace checks passed. Proof: supporting-copy-spacing.jpg.

## 2026-10-22 Corrected source piano-roll requirement
- User clarified piano roll must remain available when attaching source audio; only MIDI upload/conversion was to be excluded. Removed the mistaken audioOnly filter: source choices are upload, record, piano roll. Source recording still has no HTI conversion callback, and upload accepts audio formats only.
- SourcePianoEditor reuses StudioToolbar, TeamPianoRoll, note settings and composition playback in the existing 844x390 landscape viewport. Controlled notes/BPM and source metadata survive entering/leaving it; completion renders local piano notes to a WAV audio attachment with existing samples/fallback. Extracted the existing WAV encoder for reuse. BPM changes/export enforce the same one-minute limit.
- Profile/edit footer + now creates a song even though their separate search scope remains people. Shared creationForView/creationLabels keep the action and accessibility label aligned; social and scoped-search creation behavior remains unchanged.
- Browser verified Profile + -> new song metadata form; Source -> Audio -> three choices -> piano roll -> two notes -> audio selected and submit enabled -> piano roll reentry retains both notes and metadata. Production source creation API limitation is unchanged.
- Added navigation regression and PCM WAV encoding tests; 45 tests and build passed. Restarted stale Vite dev server after dynamic module fetch failures; current server session60786, port5173. Proof: source-piano-restored.jpg.

## Community administrator review — 2026-10-22
- Replaced the hard-coded owner/user-1 screen with the selected community and explicit ownerId checks. Missing ownership never grants access; owner controls are available from the community detail banner. Platform review remains separate.
- Reused CommunityDetailScreen/CommunityPost for real gallery content and shared comments; Figma admin menu (15236:41268) is anchored near the option button with report/hide/delete. Detail hide/delete returns to its community; the footer creates a post in that community. Creator membership is a read-only badge.
- Rebuilt member search/list (15242:41608), member menu (15242:42077), suspension/expulsion dialogs (15242:42078–42079) using Figma SVG assets and existing canvas dialogs/anchored-menu behavior. No self-sanctions; reason required, suspension is 30 days.
- Preview-only moderation checks authoritative demo ownership, scopes posts/members to a gallery, updates member status/count and removes deleted posts. Production member-list/moderation contracts are absent: no invented API calls or fake production successes. These still require backend endpoints and enforcement. Preview state lasts for the current loaded session.
- Added permission/isolation tests in src/lib/api/community-admin.test.mjs. Browser checked search/clear/empty state, suspension, expulsion/count, post detail deletion/return.

## Usability code audit — 2026-10-22
- No browser automation capability available for this audit: do not claim a fresh visual walkthrough.
- Profile back restores originating view/community/post; returning from a short author's profile remembers the current short. Chat preview recipient links to user 3 rather than the signed-in profile.
- Post creation waits for a valid gallery response; failed/missing gallery targets cannot submit. Form inputs lock during submission. Creation drafts (text/files/audio/notes) are retained in tab memory by preview/live, user and form kind, cleared on successful creation; file previews recreate object URLs on remount. Refresh persistence is not implemented.
- Comment pagination retry clears old errors; reply initial-load failures have retry, and writing/replying is disabled when unauthenticated or unavailable. Missing posts have retry and cannot accept comments. Feed statistics no longer swallow post-card clicks.
- Search has retry and fetches all post result pages, stopping on empty/repeated responses. Community isolation is checked on every page.
- Open-source detail uses actual attached audio for play/pause/seek/mute/duration, disables controls without media, and reports playback errors. Unknown source ids show missing-content feedback instead of a different source.
- Remaining functional gaps: production follower/following lists, report submission, open-source save-to-resource-library linkage, production source creation/comments, community member moderation contracts. Existing local-only source save toggles do not populate the resource library.

## Frontend completion — 2026-10-22
- Creation drafts now persist text/notes/BPM in account- and environment-scoped localStorage and image/audio Files in IndexedDB. Loading gates the form until attachments restore; file transactions are serialized per key to prevent discard/save races. Repeated typing does not rewrite unchanged files. Storage failure is visible.
- Added explicit attachment removal and draft-discard confirmation, using existing canvas dialogs. Submit and discard clear persisted drafts.
- Open-source list/detail/bookmark button now share account-scoped saved-source state. Settings > open-source library includes saved source cards, actual local audio preview, search and unsave; saved audio Files survive refresh. The sample without audio stays read-only. Audio bookmarks are excluded from MIDI-note import; MIDI library behavior is unchanged.
- Added browser back/forward and refresh restoration for app navigation context, preserving framework history state. Only navigation changes push entries; typing replaces the current snapshot. Header/search back use native managed history where available, with original fallback otherwise. Auth credentials and pending login tokens are never stored in navigation snapshots.
- Portrait touch keyboards use visualViewport height while retaining the canvas scale, and sheets/dialogs clamp to visible height with internal scrolling. Normal/landscape composition geometry stays unchanged. Native device validation still requires browser/device tooling, currently unavailable.
- Regression coverage includes storage hydration across module reload, retained Files, discard versus pending writes, source bookmark persistence/removal/account separation, and history back/forward/refresh/search typing.

## Playback, controls and timeline refinement — 2026-10-22
- Submission/workspace playback and open-source playback now render the same AudioPlaybackBar with play/pause, elapsed/total time, seek and mute. Actual MIDI/audio playback engines remain connected. Submission's ambiguous “작업 이어하기” is now “곡 편집기로 이동”: it opens the existing project rather than creating a new song.
- Standard action buttons use Pretendard Medium 16/20; compact filter chips use 12/18. Open-source save controls have content-sized widths (저장 versus 저장됨), consistent 40px height and 16px horizontal padding.
- Added a time-adjacent open-source + popup to both the timeline and piano roll. Timeline imports saved MIDI resources or locally retained audio; piano roll imports MIDI notes into the current layer after saving unsaved edits. Saving a newly created clip refreshes composition before reopening the popup, preventing duplicate clips on subsequent saves.
- Owned editable clips support pointer dragging and keyboard arrows/Home/End, snapped to the existing 20px grid. Moves are clamped to song length and reject same-layer overlap. Read-only clips remain fixed. Preview supports MIDI and audio position updates, including startTimeMs; the existing production endpoint supports MIDI moves only, so production audio movement remains unavailable without its API contract.
- Rechecked Figma V3 Admin / Report Row (15310:42752), Admin / Report Gallery (15310:44463), Admin / Report Review (15272:42541), Open Source / Song Row (11678:20030), and default open-source navigation icon (11481:18279). Updated admin typography/action layout, removed obsolete member-count copy, and replaced the navigation icon with the current Figma asset.
- Added timeline snapping, collision, permissions and preview timing regression tests. 62 tests pass. Fresh visual interaction and native-device verification are unavailable because this session has no browser-control tools; no new visual validation is claimed.

## Editable popup values — 2026-10-22
- Community suspension duration is now a numeric field (default 30, 1–365 whole days). The chosen duration is passed into preview moderation, stored as the actual suspendedUntil timestamp and shown in the confirmation notice. Invalid durations are rejected before mutation; reason remains required.
- Volume, BPM and note-velocity popup readouts now accept direct numeric input, applied on Enter/blur and synchronized with existing sliders. Empty edits revert and values clamp to each control's supported range; unsupported effects remain read-only.
- Updated community moderation regression to verify custom 7-day expiration and reject invalid durations. Live community moderation still needs its backend contract.

## Editable time signature — 2026-10-22
- Replaced the fixed beat 4/4 popup with editable beats per bar (1–12) and beat unit (2, 4, 8). Enter/blur applies the numerator and changing the unit applies immediately.
- Toolbar, timeline measure ticks, piano-roll bar numbers and metronome beat duration/accent share the selected signature. Tempo and note timing remain quarter-note based; changing signature changes grouping rather than stretching music.
- Settings persist locally per environment, account and project and synchronize between timeline/piano roll. This is frontend-only storage; the current project API has no time-signature field. Editing another owner's composition does not expose global signature mutation.
- Type check, targeted lint and 64 tests pass, including 3/4, 6/8 and 2/2 beat/bar timing and invalid stored signature fallback. Browser interaction is still not available for direct visual verification.

## Unrestricted signature input and aligned beat grid — 2026-10-22
- Removed the arbitrary 12-beat cap and 2/4/8 selector; both signature values now accept positive safe integers directly (including 31/16 and 17/3). Zero, negative and non-integer values remain invalid. No additional musical whitelist is imposed.
- Timeline and piano roll now use one shared musical ruler/grid calculation: 20px per eighth-note editing step, 160/denominator pixels per beat, numerator beats per measure. Both beat and measure separators span the editing grid and align with the ruler, including fractional-cell beat positions.
- Removed obsolete 21px cell repetition and fixed 80px heavy separators. Content width uses exact tick length rather than rounding the song end to a full cell; ruler seek, clip positions and note positions share that width.
- Label density is reduced only to avoid overlapping measure numbers; beat/measure boundaries remain at their exact positions. CSS gradients avoid creating unbounded DOM nodes for unusual denominators.
- Type checking, targeted lint and all 66 tests pass, including uncommon signatures, fractional beat spacing and bounded label generation. No fresh browser visual verification is claimed.

## Corrected overlapping signature grids — 2026-10-22
- User screenshot exposed irregular thin cells at 17/3: fixed eighth-note lines and denominator-specific beat lines were overlaid. Replaced that incompatible pair with two equal subdivisions per beat. Beat and measure boundaries are now exact multiples of the same cell spacing.
- Kept quarter-note time at 40px so changing signature does not stretch existing music or shift clip timing. Piano-roll editing and timeline dragging use the same signature-derived tick step and pixel step. Existing notes are not rewritten by changing signature.
- Ruler uses bright lines over its blue-gray background; editing area uses muted lines. Removed duplicate horizontal edges/gutters from the timeline grid so each 46px lane has one boundary.
- 68 tests pass, including 17/3 cell/beat alignment, constant song width across denominators and drag/snap spacing. Type/lint checks passed. Fresh browser visual validation remains unavailable; mathematical/build checks are not a substitute for that.

## Reference palette with original brand colors — 2026-10-22
- User requested the supplied dark piano-roll image as the new color reference, preserving layout and making a backup first. Created backups/before-reference-palette-2026-10-22/frontend-source.tar.gz (src, public, scripts and project config; no dependencies, build output or environment secrets). Extract to a separate directory for selective restore; README included.
- Sampled reference pixels: background near #08080C, panels #101115, grid rows #15151C. Added reference-palette.css as the last global import, with neutral dark surfaces, subtle gray/violet grid lines, light keys and off-white copy. Routed legacy neutral CSS literals and inline player/grid colors to shared tokens. Existing SVG neutral fills use the new palette with geometry/variants unchanged.
- User clarified brand violet/navy must stay as before: --purple remains #4C00E5 and --primary-deep #24006B (soft #EDE6FC). Primary controls, notes, clip colors and recolored icons retain this family. The reference's brighter violet replacement was removed before delivery.
- Source CSS changes versus the backup were audited as color-literal-only substitutions; the additional palette layer contains color/background/border-color declarations. Screen layout, spacing, typography and interaction were not redesigned.
- Browser verification is now available through bundled Playwright using the installed Chrome channel (the bundled Chromium executable is absent). Headless Chrome rendered home, social, open-source, settings, admin and the song-creation -> piano-roll flow; screenshots inspected. Computed brand values confirmed #4C00E5 / #24006B; no page errors during the walkthrough. Screenshots: /tmp/narackrock-palette-{home,opensource,settings,admin,social,creation,piano}.png.
- Production build succeeded. Type/lint checks run on changed TSX/TS; no new tests were added for the reversible palette-only change.

## Palette brightness and creation-card descriptions — 2026-10-22
- Lifted background #08080C -> #101014 and surfaces #15151C -> #1C1C24, with coordinated panel, border, muted text and grid brightness. Brand #4C00E5 / #24006B remains unchanged. Updated SVG neutral fills to match the raised surface/muted tokens.
- Added 8px between each creation-card title and a short description: upload imports audio as a layer, recording captures performance/voice, piano roll places notes to create melody. Shared 12/18 supporting type and 24px image gap keep all cards consistent.
- The old piano-roll thumbnail baked in obsolete blue-gray colors. Replaced only that decorative thumbnail with a CSS illustration using current grid/key/note tokens; original PNG remains available and in the pre-palette backup. Card artwork ratio and rounded shape remain consistent with upload/record.
- Verified in headless Chrome: all three descriptions, updated computed neutral/brand colors, creation -> piano roll flow and no page errors. Creation screenshot /tmp/narackrock-palette-creation.png inspected. Type/lint/build and whitespace checks passed.

## Second palette brightness adjustment — 2026-10-22
- User requested another small brightness increase. Background #101014 -> #18181D; surface #1C1C24 -> #25252E; coordinated raised panels, borders and studio grid shades raised accordingly. SVG neutral fills follow these surface tokens. Brand #4C00E5 / #24006B, typography and layout unchanged.
- Re-ran the local Chrome preview walkthrough for updated palette rendering; no new behavior or tests introduced for this color-only adjustment.

## Preview canvas separation — 2026-10-22
- Changed only the /preview workbench background to neutral #35353D and added a subtle non-layout outline/shadow around the design canvas. Actual app background remains #18181D, preventing the app and desktop preview backdrop from merging visually. Scoped through .v3-preview; production app colors are unchanged.

## Discovery sections — 2026-10-22
- User clarified open-source discovery should follow the home page's stacked sections, not tabs. Open-source now shows a horizontal “추천 오픈소스” rail followed by a ranked “인기 차트” list, reusing the existing source card/detail/save controls. Both sections render on the same page; no tab list.
- Home now has “추천 음악” using the shared SongRail and its own 모두보기 chart view. Recommended feed comes from the existing public shorts endpoint; frontend selection excludes own items where alternatives exist and promotes different authors first. This is deterministic frontend curation, not a new personalized-recommendation service.
- Source chart sorts usage count descending (newest id tie-break). Source statistics now come from each local source record rather than hard-coded component text; preview seed retains its sample counts and new uploads start at zero. Only one seeded source currently exists, so it can appear in both discovery sections.
- Regression tests cover author diversity/own-item fallback, non-mutating usage ranking. 70 tests pass; type/targeted lint checks passed. Chrome verified recommendation 모두보기, both open-source sections without tabs, rank display, shared save state across both cards and detail navigation, with no page errors. Screenshots /tmp/narackrock-{opensource-sections,home-recommendations,recommended-music}.png inspected.
- Preview outer background was subsequently tuned to #25252C per user, while app background stays #18181D.

## Discovery spacing correction — 2026-10-22
- Aligned home and open-source discovery vertical spacing: 30px top/bottom content padding, 20px title-to-content gap, 40px between sections. Open-source keeps 20px horizontal padding; its reused cards now have 16px inner padding and 16px internal gap. Home rails/title retain their shared 20px horizontal inset.
- Removed the accidental 10px open-source top padding. Section headers now have a 24px minimum line box to avoid tight/clipped 20px headings.
- Headless Chrome measured computed padding/gaps and asserted actual title-to-content distance on both screens (home and open-source). Screenshot /tmp/narackrock-spacing-opensource.png inspected; whitespace check passed.

## Notification categories, resume-first home and post sanctions — 2026-10-25
- Added visible notification badges for received/sent participation requests, approval, rejection/cancellation, and whether a rejected part can/already did convert to open source. Existing notification review/detail/preservation callbacks remain connected.
- Home now begins with “작업 중인 음악”: recent editable drafts or the viewer's pending draft layers, newest first (up to three), with direct resume into that project and a full workspace link. Empty state offers song creation. Popular chart remains before recommendations below it. Read-only/finished entries are filtered rather than advertised as resumable; workingMusic tests cover selection and ordering.
- Social adds 20px after the shared header and 16px after its navigation tabs so the logo, tab labels and post identity row have distinct spacing.
- Community feed, community detail/admin feed and post detail menus expose author suspension/expulsion only when known gallery ownership permits managing that author; self/creator actions are not offered. Feed moderation derives gallery from its list context because PostListItem has no gallery property. Post detail derives it from the fetched post and gallery list.
- Extracted shared MemberActionDialog for list/post actions, including visible target name, required reason and existing editable duration. Preview uses the existing authoritative moderation function (owner/member/gallery checks). Live API contract is still absent: production confirmation reports unavailability rather than inventing a successful server call.
- Chrome end-to-end verified creation -> MIDI note -> home draft first -> resume, badge rendering, measured social spacing, post-menu seven-day suspension reflected in member list, expulsion reflected in member removal, and no page errors. Screenshots /tmp/narackrock-{home-working-first,notification-badges,social-header-space,post-member-menu,post-suspension-dialog}.png inspected.
- 72 tests and type/targeted lint checks pass. Development preview restarted on port5173 (session61661).

## Submission review, explicit back destinations and initial source import — 2026-10-25
- Rechecked Figma timeline 6779:12694 and full-fidelity children 13433:27931 / 13433:29270 / 8008:14079, including screenshots. Confirmed 844x390 canvas, 44px toolbar, 98px sidebar, 25px ruler, 40px clip content, 42px row border box and 4px gap (46px lane). Current canvas effective geometry was already proportional; restored the omitted row gutters/borders to match this geometry while preserving the user-approved palette and beat grid.
- Removed unnecessary playback-mode controls from the author's own submission detail, and removed the redundant track-name/instrument/clip-count row from submission and review screens. Incoming reviews use a single-choice radio group for extra layer versus original+layer. Older stored submissions without baseComposition now fetch the original and exclude submitted track ids for comparison.
- Put pending-request approval/rejection actions before playback; rejection requires a reason. Processed requests explicitly state that they are already approved/rejected, rather than offering a second decision. Both incoming reviews and own submissions link to their published song when shortId exists. No fabricated link is shown for unpublished music.
- Fixed new-song source import being hidden after the first owned track: the one-layer rule applies to participation, while an editable new song can add further source layers. Time-adjacent button now visibly says “+ 오픈소스”. CUA verified importing first and second MIDI resources into a brand-new empty timeline without entering the piano roll.
- UI back buttons now follow explicit workflow parents and replace the current history frame instead of pushing a new reverse entry. Studio stores its originating page/item/notification context; song viewing stores its origin; search/source steps, submission detail and edit-profile retain logical parents. Normal browser back/forward snapshot restoration remains available. Guards prevent submission-detail being its own parent; old snapshot origin fields have migration fallbacks.
- CUA verified: source popup on the user's existing draft; own rejected detail has no redundant modes/row; song link -> Abyss -> original submission detail; mutually exclusive comparison modes; isolated fresh-origin pending review -> rejection reason -> processed status; new song -> empty timeline -> two source layers; studio -> home; settings -> profile edit -> back to settings. Existing user request data was preserved; decision/import tests used http://[::1]:5173/preview as an isolated origin.
- npm test: 73 passed. Explicit contribution-session .mjs suite (not included by the package glob): 7 passed. Type checking and targeted lint passed. Screenshots /tmp/narackrock-review-mode-fixed.png and /tmp/narackrock-timeline-source-fixed.png; Figma reference /tmp/narackrock-figma-timeline.png.

## 2026-10-26 — Four-size UI type scale and home work list
- Everyday text now uses shared `--text-caption` 10px (changed from 12px at the user's request), `--text-body` 14px, `--text-label` 16px, `--text-title` 20px in `src/app/typography.css`; normalized CSS declarations throughout screens, comments, administration, composition, forms and menus. Tailwind sizes align with the same scale. Existing profile display name (25px in V3), profile stats (18px), large song/auth display headings and icon glyphs deliberately retain their original sizes per user clarification.
- `HomeWorkSection` now uses one compact divided panel with small neutral audio icons, single-line titles, layer/BPM metadata, relative last-edit time and a trailing chevron. Removed repeated action copy and large purple tiles. Entire row remains the existing resume action; preserved sorting and navigation.
- Before-change source snapshot: `/tmp/narackrock-before-type-scale-2026-10-26.tar.gz`.
- Verified via CUA computed fonts: home, settings, opensource feed/detail, comments/options, studio and beat popup. Profile name remains 25px and stats 18px. Home resume opens the same composition; returns to home and reorders on update. TypeScript and targeted ESLint passed; production build passed.

- Follow-up typography correction: five sizes 10/12/14/16/20px. Restored shared caption text to 12px; added `--text-navigation:10px` exclusively for bottom-navigation labels. Profile display sizes remain unchanged.

## 2026-10-26 — Draft cards redesigned again; notification category dropdown
- Replaced the divided vertical working-music panel with horizontally scrolling, snap-aligned project cards (244px). Each card displays a small arrangement preview drawn from its actual clip start/duration data (up to four tracks), modified time, title and layer/BPM metadata; preserved resume action, most-recent ordering, empty-state action and workspace link. No generated artwork or fake waveform data.
- Notifications now have a labeled native category dropdown: all, received pending requests, sent pending requests, approved, rejected/canceled, and open-source conversion (including completed conversions). Filters both inbox and local submission events, shows matching count and category-specific empty state. Keyboard focus trap includes the select.
- TypeScript, targeted ESLint and production build passed. CUA verified home layout and filtering: all=2, approved=1, received=0 with empty message, resource=1, reset all=2. Proof `/tmp/narackrock-draft-cards-redesign.png`, `/tmp/narackrock-notification-filter.png`.
- User replaced the notification dropdown with one horizontally scrolling row of category buttons (`aria-pressed`, one selected at a time). Follow-up: compact size 12px text / 28px height, 6px gaps, 10px horizontal padding; labels shortened to 전체/받은 요청/보낸 요청. Selecting scrolls the chosen chip into view; count/filter/empty-state behavior retained. Verified actual computed sizes and selection in CUA. TypeScript/ESLint passed for chip conversion. Screenshot `/tmp/narackrock-notification-compact-chips.png`.
