# Narackrock Frontend

음악 감상, 커뮤니티, 공동 작곡 기능을 제공하는 React 19 + TypeScript + Vite 앱입니다.

## 실행

Node.js 22.13 이상이 필요합니다. 처음 설치할 때 `npm run install:ci`를 실행하세요.

```sh
cp .env.example .env.local
npm run dev
```

개발 서버는 http://127.0.0.1:5173 에서 실행됩니다.

- `/`: 별도 백엔드 API를 사용하는 앱

## 환경 변수

- `VITE_API_BASE_URL`: 명시적 백엔드 origin (예: `http://127.0.0.1:8081`). REST와 STOMP `/ws/chat`이 같은 base URL을 사용합니다. 별도 Vite API proxy는 없습니다.
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth용 공개 클라이언트 ID. Google의 허용 JavaScript origin과 백엔드 OAuth 설정도 필요합니다. 서버 비밀값은 Vite 변수에 넣지 않습니다.

브라우저 환경 변수는 Vite의 `import.meta.env`로 읽습니다. 변경 후 개발 서버를 재시작하세요. 기존 `.env.local`을 덮어쓰지 않고 격리 서버를 사용하려면:

```sh
VITE_API_BASE_URL=http://127.0.0.1:8081 npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

백엔드는 해당 frontend origin을 CORS에 허용해야 합니다. signed media URL은 서버 응답 그대로 사용합니다. Google OAuth, 실제 HTI 변환 서비스, 마이크·OS 가상 키보드는 별도 환경 준비가 필요합니다. 운영 API를 대상으로 변경 요청 smoke를 실행하지 않습니다.

## 검증과 빌드

```sh
npm run format:check
npm run lint
npm test
npm run build
npm start
```

`build`는 TypeScript 검사 후 정적 파일을 `dist/`에 생성합니다. `start`는 빌드 결과를 로컬에서 확인합니다.
배포 서버는 `/communities/7`, `/studio/42` 같은 직접 접근 경로를 `index.html`로 전달하도록 SPA fallback을 설정해야 합니다.
백엔드는 프론트엔드의 실제 출처에 대한 CORS 요청을 허용해야 합니다.

## 구조

같은 기능의 페이지, 화면, 훅, 테스트는 `src/features/<기능>/`에서 함께 찾습니다.

```text
src/
  app/               # 앱 진입, 직접 라우트 트리, provider 조합, 앱 런타임
  features/
    auth/            # 로그인, 최초 가입, 인증 상태
      pages/         # login-page.tsx, onboarding-page.tsx
    home/            # 홈, 차트, 곡 목록 조회
    posts/           # 게시글 목록, 카드, 댓글, 작성 페이지
    community/       # 커뮤니티 목록·상세·가입·관리
    social/          # 소셜 탭, 친구, 채팅
    composition/     # 스튜디오, 피아노롤, 녹음·업로드, 오디오 처리
      pages/         # 스튜디오·레이어·노트 편집 라우트
    workspace/       # 작업 목록, 제출·검토, 리소스 보관함
    profile/         # 사용자 프로필과 편집
    sources/         # 오픈소스 페이지
    navigation/      # URL 이동, 경로 유틸리티, 헤더·푸터와 생성 목적지
    ...              # notifications, search, saved, settings, admin, abyss
  components/
    ui/              # viewport, portal, 다이얼로그, 아바타와 공용 재생 UI
  hooks/             # 여러 기능에서 쓰는 범용 훅
  lib/
    api/             # API 클라이언트, 응답 타입, 서버 요청
    browser/         # 브라우저 저장소
  styles/            # Tailwind 공통 토큰, variant, 화면 프리셋
```

| 찾는 내용                         | 시작할 파일/폴더                                                                             |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| 앱 실행                           | `src/main.tsx` → `src/app/App.tsx`                                                           |
| URL에 연결된 페이지               | `src/app/routes.tsx`                                                                         |
| 페이지별 헤더·푸터·viewport 조합  | 각 `src/features/<기능>/pages/*.tsx`                                                         |
| 공통 헤더·푸터 구현               | `src/features/navigation/header.tsx`, `src/features/navigation/footer.tsx`                    |
| 인증 / 어비스 음소거 상태         | `src/features/auth/auth-session.tsx`, `src/features/abyss/playback-preferences.tsx`           |
| 특정 기능의 페이지                | `src/features/<기능>/pages/`                                                                 |
| 스튜디오 화면·상단 도구·노트 편집 | `src/features/composition/studio-screen.tsx`, `studio-toolbar.tsx`, `note-editor-screen.tsx` |
| 특정 로직의 테스트                | 같은 폴더의 `*.test.ts` 또는 `*.test.mjs`                                                    |

페이지 파일은 URL 파라미터·검색 문맥·이동 행동과 자신의 `DesignViewport`, `Header`, `Footer`, `NotificationsOverlay`를 직접 조합합니다.
공용 layout 설정이나 slot wrapper로 화면 역할을 추론하지 않습니다. resource ID가 잘못되면 chrome 안에 오류를 표시하고 해당 resource 화면을 마운트하지 않습니다.
`src/app`에는 `App.tsx`, `routes.tsx`, `providers.tsx`, `runtime.tsx`만 둡니다. provider는 children을 받고 feature 상태는 소유 feature에 둡니다.
API 폴더에는 실제 서버 요청과 API 클라이언트 테스트를 두고, 나머지 테스트는 해당 기능 옆에 둡니다.
사용하지 않는 shadcn 기본 컴포넌트와 전용 의존성은 제거했습니다. `components.json`은 향후 필요한 컴포넌트를 생성할 때 쓸 설정으로 유지합니다.
`npm test`는 `src/` 아래의 테스트를 하위 폴더까지 자동으로 찾아 실행합니다.

Next.js/Vinext와 서버 전용 스타터 코드는 제거했습니다. 과거 작업 이력은 `CONTEXT.md`에 보관되어 있습니다.

## 코드 포맷

```sh
npm run format        # 줄바꿈·들여쓰기·따옴표·세미콜론 정리
npm run format:check  # 파일을 수정하지 않고 포맷 검사
```

Prettier 설정은 `.prettierrc.json`, 기본 편집 규칙은 `.editorconfig`에서 관리합니다.
들여쓰기는 공백 2칸, 일반 코드의 줄 너비는 100자를 기준으로 합니다.
환경 파일, 빌드 결과, 원본 자산, 과거 작업 이력, `.thinkrail/` 작업 메타데이터는 포맷 대상에서 제외합니다.

## 페이지 이동

페이지는 React Router로 이동하며, URL을 직접 열거나 새로고침해도 해당 화면이 열립니다.

| 화면                    | 경로 예시                                    |
| ----------------------- | -------------------------------------------- |
| 홈 / 차트               | `/`, `/charts?kind=recommended`              |
| 커뮤니티 / 게시글       | `/communities/7`, `/communities/7/posts/12`  |
| 검색                    | `/search?scope=posts&q=piano&galleryId=7`    |
| 오픈소스 / 댓글         | `/sources/8`, `/sources/8/comments`          |
| 내 프로필 / 다른 사용자 | `/profile`, `/users/3`                       |
| 새 곡 / 작업 중인 곡    | `/studio/new`, `/studio/42`                  |
| 레이어 추가 / 녹음      | `/studio/42/layers/new`, `/studio/42/record` |
| 노트 편집               | `/studio/42/tracks/3/notes?clipId=9`         |

검색 조건과 선택한 리소스는 URL에 보관하며, 뒤로·앞으로 가기는 React Router의 브라우저 기록을 사용합니다.
알림은 현재 화면의 URL에 `notifications=1`을 추가해 표시하므로 작성·녹음 중인 화면을 유지합니다.
`useUrlNavigation`은 `to`, `back`, `params`, `query`, `state`, `currentPath`만 제공합니다. 화면 컴포넌트에는 `onProfile`, `onStartSong`처럼 필요한 행동 callback만 전달합니다.
검색 문맥은 query 값 → 커뮤니티의 posts → 페이지 기본값 순서로 결정합니다. 생성 목적지는 페이지가 계산하며 프로필의 생성은 항상 곡 만들기입니다.
스튜디오 최초 진입은 `studioFrom`과 `studioIndex`를 기록하고 레이어·녹음·노트 이동에서는 이를 보존합니다. 알림은 기존 query와 route state를 유지합니다.
portal host는 각 페이지 mount의 layout effect에서 찾고 body fallback을 사용하지 않습니다. viewport 크기·회전·키보드 정책은 기존 디자인 canvas 기준을 유지합니다.

## 스타일 작성

Tailwind CSS 4를 사용하며 공통 값과 스타일은 TypeScript에서 관리합니다.

- `src/styles/tokens.ts`: 색상, 글꼴, 텍스트 크기, 모서리, 간격의 원본 값.
- `tailwind.config.ts`: 토큰을 Tailwind 테마와 동적 오디오·레이아웃용 CSS 변수로 연결.
- `src/styles/variants.ts`: 공통 버튼, 필터 칩, 상태 배지, 반응 컨트롤, 아이콘 슬롯의 타입 안전한 `cva` variant.
- `src/styles/*.styles.ts`: 화면과 기능별 Tailwind 프리셋. 기존 상태·상위 화면 선택자는 arbitrary variant로 표현합니다.
- `src/global.css`: 유일한 앱 CSS 진입점. Tailwind 연결, 폰트 로딩, 기본 요소, 스크롤바 유틸리티, 네이티브 키프레임만 둡니다.

```tsx
<button className={buttonVariants({ tone: "primary", size: "compact" })}>저장</button>
<div className={cn(studioStyles.studio, studioStyles.noteEditor)}>...</div>
```

조건부 클래스는 `cn()`으로 합칩니다. 앱의 텍스트 크기도 병합 규칙에 등록되어 있습니다.
프리셋의 marker 클래스는 포털, 드래그 좌표, 상태 선택자에서 사용하므로 유지하세요.
오디오 진행률이나 타임라인 좌표처럼 값이 계속 바뀌는 부분은 기존의 인라인 스타일과 CSS 변수를 사용합니다.

## API 지원 범위

계약 기준: backend `dev`의 `240487735c52130ced6c654baf63915f91a554e2`. 없는 API를 로컬 성공 데이터로 대체하지 않습니다.

| 영역 | 연결한 계약 | 실제 제한 |
| --- | --- | --- |
| 인증 | bearer session, 단일 refresh와 원요청 최대 1회 재전송 | refresh 400/401은 만료, 네트워크/5xx는 session 유지. 계정 전환 후 늦은 응답은 무효. 다른 탭 logout 실시간 동기화는 미지원 |
| 오픈소스 | 인증 목록·검색·상세·signed 재생·반응·댓글·서버 보관, 업로드→PRIVATE→명시적 PUBLIC | 인기·추천, 신고, 댓글 수정/삭제/신고, source-ID 기반 프로젝트 삽입 미지원 |
| 숏폼·게시글 | ID 딥링크, 반응·댓글·신고·bookmark·공유·조회수 | mute 조회 API가 없어 감상 음소거는 session-only. 익명 감상은 가능, 보호된 행동은 로그인 필요 |
| 친구·프로필·채팅 | public follow/private 요청·승인·관계 접근권, REST 발송·STOMP 수신과 연결 단절 중 polling | WebSocket CONNECT마다 현재 bearer 사용. 비공개 목록의 403은 빈 목록으로 숨기지 않음 |
| 커뮤니티·관리자 | 개설 신청·내 신청·admin 검토, manage/me 권한, 설명·제재·운영 삭제·신고 처리 | 신청은 즉시 커뮤니티 생성이 아님. 전체 회원 명부, 커뮤니티 사진·이름 변경 계약 없음 |
| 알림 | 기여 알림과 별도 follow 요청 | 일반 알림 history/read/unread 미지원 |
| 스튜디오 | 서버 timing·악기 계열·다중 sample, 개인 editor draft·명시적 commit·원자적 submit, 실제 검토·export polling | 원작성자만 DRAFT/IN_PROGRESS timing 수정. 알 수 없는 악기·sample 실패는 오류 표시 |
| 작업·제출 | 환경·계정별 방문 이력의 live composition, 알려진 프로젝트별 contribution cursor 전체 조회 | 전체 프로젝트 목록·cross-project 보낸 제출 API와 불변 제출 음원 snapshot 없음 |

공유 응답의 엔티티 ID를 검증한 뒤 현재 frontend origin의 `/abyss/:id`, `/posts/:id`, `/sources/:id`로 canonical 링크를 구성합니다. 서버 기본 `/shorts/:id` 링크를 앱의 `/abyss/:id`로 변환하며 운영 share 설정을 변경하지 않습니다.

### 개인 초안과 공유본

피아노롤 편집·이동·velocity·MIDI 가져오기는 공유 clip을 autosave하지 않습니다. backend origin·계정·프로젝트·트랙·clip으로 격리한 로컬 복구본과 1초 debounce의 개인 서버 초안을 사용합니다. 저장 상태와 revision 충돌을 표시하며 충돌 시 서버본 열기, 로컬 JSON 내보내기, 명시적 재적용을 제공합니다.

- **저장 후 나가기**: flush 후 명시적으로 공유 clip에 commit.
- **개인 초안 유지**: 다른 참여자의 공유본은 변경하지 않고 복귀.
- **버리기**: revision 확인 후 개인 초안만 삭제.
- 일반 브라우저 back·페이지 이탈은 공유본 반영이 아닙니다. 로컬 복구도 실패한 dirty 상태만 이탈 경고합니다.
- 기여 제출은 `editor-drafts/submit`의 draft 반영+contribution 생성을 한 트랜잭션으로 요청합니다. 실제 contribution ID·상태만 사용합니다.
- 원작성자의 곡 올리기는 개인 초안 일괄 commit 후 본인 기여 검토와 export 생성·상태 확인을 수행합니다.

악기는 확인 시만 track을 생성합니다. 녹음은 명시적인 악기 또는 vocal/backing-vocal/rap/percussion/other 역할을 선택하며 MIDI에는 audio-only 역할을 허용하지 않습니다. 드럼 MIDI 음역은 35–81입니다. 샘플은 `public/audio/instruments`의 실제 mp3·라이선스를 사용합니다.

### 기존 브라우저 자료 이관·복구

설정의 **이 브라우저 데이터 이관·복구** (`/settings?migration=1`)에서 대상 origin·계정과 원본을 확인하고 항목별로 동의합니다. mount나 로그인만으로 이관하지 않습니다. guest/다른 scope 자료의 귀속도 사용자가 명시적으로 확인해야 합니다.

- bookmark는 전체 서버 목록과 상세 메타데이터를 먼저 확인하고 필요할 때만 1회 toggle한 뒤 다시 읽습니다. 중단·응답 유실 뒤에도 상태부터 확인합니다.
- source는 유효한 서버 제목·작성자·소유권이 일치할 때 idempotent PUT으로 보관합니다.
- 직접 작성·소유했음을 별도로 확인한 오디오만 PRIVATE publication으로 업로드합니다. 공개 전환은 하지 않습니다.
- 계정·환경별 journal과 Web Lock을 사용합니다. upload/media ID와 publication 이전 ID 집합을 기록하고, 응답 유실 시 유일한 새 media·메타데이터 일치만 연결합니다. 결과가 불명확하면 자동 재업로드·재등록하지 않습니다. 다른 기기의 동시 toggle까지 원자성을 보장하지 않습니다.
- 로컬 MIDI는 JSON 내보내기 또는 사용자가 고른 편집 가능한 내 트랙의 개인 초안으로 가져오기만 가능합니다. 서버 MIDI 보관함으로 이전했다고 표시하지 않습니다.
- 이전 작업은 소유·참여·접근권 검증 후 새 방문 이력에만 추가합니다. 전역 초안 포인터는 자동 resume하지 않습니다.
- 과거 로컬 Date.now 제출 ID·snapshot·미완성 작성물은 복구 자료로만 남습니다. 서버 review 요청에 사용하지 않습니다. 새 제출 링크는 `/submissions/:id?projectId=:projectId`이며 현재 clip을 과거 제출 음원으로 재생하지 않습니다.
- 성공·실패와 무관하게 기존 localStorage·IndexedDB 원본은 자동 삭제하지 않습니다. 파일이 없는 자료와 미지원 자료는 사유를 확인하고 원본 JSON/오디오를 내보낼 수 있습니다.

### 백엔드 후속 계약

openSourceId를 이용한 출처·권한·usageCount·clip 생성의 원자적 삽입, source 인기/추천·신고·댓글 관리, 전체 커뮤니티 회원 명부, 일반 알림 이력/read, 전체 프로젝트와 cross-project 제출 목록, 불변 제출 snapshot, 영속 mute 조회가 필요합니다. 미리듣기 URL 재업로드로 source 삽입을 우회하지 않습니다. cross-tab session sync와 실제 OAuth·HTI·배포 share 환경 검증도 별도 준비 항목입니다.
