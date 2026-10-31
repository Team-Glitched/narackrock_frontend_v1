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

- `VITE_API_BASE_URL`: 백엔드 주소 (예: `http://localhost:8080`)
- `VITE_GOOGLE_CLIENT_ID`: Google 로그인용 공개 클라이언트 ID

브라우저 환경 변수는 Vite의 `import.meta.env`로 읽습니다. 환경 변수를 바꾸면 개발 서버를 재시작하세요.

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
  app/               # 앱 실행, 전체 라우터, 공통 레이아웃, 세션
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
    navigation/      # URL, 경로 메타데이터, 공통 이동 규칙
    ...              # notifications, search, saved, settings, admin, abyss
  components/
    app/             # 헤더·푸터, 다이얼로그, 재생 바 등 서비스 공통 UI
    ui/              # 기본 UI 라이브러리
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
| 페이지 제목·헤더·푸터 설정        | `src/features/navigation/route-config.ts`                                                    |
| 공통 헤더·푸터 배치               | `src/app/app-layout.tsx`                                                                     |
| 로그인 사용자와 공유 상태         | `src/app/session.tsx`                                                                        |
| 특정 기능의 페이지                | `src/features/<기능>/pages/`                                                                 |
| 스튜디오 화면·상단 도구·노트 편집 | `src/features/composition/studio-screen.tsx`, `studio-toolbar.tsx`, `note-editor-screen.tsx` |
| 특정 로직의 테스트                | 같은 폴더의 `*.test.ts` 또는 `*.test.mjs`                                                    |

페이지 파일은 URL 파라미터와 이동을 연결하고, 같은 기능 폴더의 화면·훅을 조합합니다.
여러 기능이 섞인 `features/screens`와 별도로 흩어진 `pages`, `layouts`는 위 구조로 통합했습니다.
API 폴더에는 실제 서버 요청과 API 클라이언트 테스트를 두고, 나머지 테스트는 해당 기능 옆에 둡니다.
`npm test`는 `src/` 아래의 테스트를 하위 폴더까지 자동으로 찾아 실행합니다.

Next.js/Vinext와 서버 전용 스타터 코드는 제거했습니다. 과거 작업 이력은 `CONTEXT.md`에 보관되어 있습니다.

## 코드 포맷

```sh
npm run format        # 줄바꿈·들여쓰기·따옴표·세미콜론 정리
npm run format:check  # 파일을 수정하지 않고 포맷 검사
```

Prettier 설정은 `.prettierrc.json`, 기본 편집 규칙은 `.editorconfig`에서 관리합니다.
들여쓰기는 공백 2칸, 일반 코드의 줄 너비는 100자를 기준으로 합니다.
환경 파일, 빌드 결과, 원본 자산, 과거 작업 이력은 포맷 대상에서 제외합니다.

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
`View` 타입은 기존 화면 컴포넌트의 콜백 호환용이며, 실제 페이지 선택은 URL 경로가 담당합니다.

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

예시 데이터 체험 모드는 제거했습니다. 모든 API 요청은 `VITE_API_BASE_URL`의 백엔드로 전달됩니다.
오픈소스 목록·검색·생성, 커뮤니티 생성·멤버 관리, 숏폼 댓글, 채팅처럼 서버 연동이 준비되지 않은 화면은 사용 불가 상태를 표시합니다.
실제 작업의 브라우저 저장과 오디오·이미지 미리보기는 각 기능에서 사용합니다.
