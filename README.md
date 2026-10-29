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

- `index.html` → `src/main.tsx`: HTML 및 React 진입점, 페이지 선택, 전역 스타일
- `src/app/App.tsx`: 앱 화면 상태와 이동 흐름
- `src/features/`: 화면과 기능별 로직
- `src/components/`: 서비스 공통 UI와 기본 UI
- `src/hooks/`: 데이터 조회와 공통 React 훅
- `src/lib/api/`: Bearer 인증 기반 API 클라이언트와 기능별 요청
- `src/features/preview/`: 예시 데이터와 가상 API
- `public/`: 폰트, 이미지, 피아노 샘플, 웹 앱 매니페스트

Next.js/Vinext와 서버 전용 스타터 코드는 제거했습니다. 과거 작업 이력은 `CONTEXT.md`에 보관되어 있습니다.
