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
- `/preview`: 로그인 없이 예시 데이터로 체험하는 앱
- `/privacy`: 개인정보처리방침

## 환경 변수

- `VITE_API_BASE_URL`: 백엔드 주소 (예: `http://localhost:8080`)
- `VITE_GOOGLE_CLIENT_ID`: Google 로그인용 공개 클라이언트 ID

브라우저 환경 변수는 Vite의 `import.meta.env`로 읽습니다. 환경 변수를 바꾸면 개발 서버를 재시작하세요.

## 검증과 빌드

```sh
npm run lint
npm test
npm run build
npm start
```

`build`는 TypeScript 검사 후 정적 파일을 `dist/`에 생성합니다. `start`와 `preview`는 빌드 결과를 로컬에서 확인합니다.
배포 서버는 `/preview`, `/privacy` 같은 직접 접근 경로를 `index.html`로 전달하도록 SPA fallback을 설정해야 합니다.
백엔드는 프론트엔드의 실제 출처에 대한 CORS 요청을 허용해야 합니다.

## 구조

- `index.html` → `src/main.tsx`: HTML 및 React 진입점, 전역 스타일
- `src/app/App.tsx`: React Router의 `RouterProvider` 실행
- `src/app/routes.tsx`: 페이지 컴포넌트와 React Router 경로 연결, 인증이 필요한 경로 보호
- `src/features/navigation/route-config.ts`: 페이지별 URL, 제목, 헤더·푸터 설정
- `src/pages/`: URL 파라미터를 읽고 각 화면의 데이터와 이동을 연결하는 페이지
- `src/layouts/app-layout.tsx`: 공통 헤더·푸터와 모바일·스튜디오 레이아웃
- `src/app/session.tsx`: 사용자 세션과 공통 상태 공급
- `src/features/`: 화면과 기능별 로직
- `src/components/`: 서비스 공통 UI와 기본 UI
- `src/hooks/`: 데이터 조회와 공통 React 훅
- `src/lib/api/`: Bearer 인증 기반 API 클라이언트와 기능별 요청
- `src/features/preview/`: 예시 데이터와 가상 API
- `public/`: 폰트, 이미지, 피아노 샘플, 웹 앱 매니페스트

Next.js/Vinext와 서버 전용 스타터 코드는 제거했습니다. 과거 작업 이력은 `CONTEXT.md`에 보관되어 있습니다.

## 페이지 이동

페이지는 React Router로 이동하며, URL을 직접 열거나 새로고침해도 해당 화면이 열립니다.

| 화면 | 경로 예시 |
| --- | --- |
| 홈 / 차트 | `/`, `/charts?kind=recommended` |
| 커뮤니티 / 게시글 | `/communities/7`, `/communities/7/posts/12` |
| 검색 | `/search?scope=posts&q=piano&galleryId=7` |
| 오픈소스 / 댓글 | `/sources/8`, `/sources/8/comments` |
| 내 프로필 / 다른 사용자 | `/profile`, `/users/3` |
| 새 곡 / 작업 중인 곡 | `/studio/new`, `/studio/42` |
| 레이어 추가 / 녹음 | `/studio/42/layers/new`, `/studio/42/record` |
| 노트 편집 | `/studio/42/tracks/3/notes?clipId=9` |

체험 모드에서는 같은 경로 앞에 `/preview`를 붙입니다. 예를 들어 `/preview/communities/7`입니다.
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
