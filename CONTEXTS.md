# Narackrock Frontend 작업 컨텍스트

## 1. 프로젝트 개요

- 제품: Narackrock/Adlips 음악 커뮤니티 웹 프론트엔드
- 현재 목표: Figma `v3`의 `Ready for dev` 디자인을 기준으로 모바일 웹을 우선 구현하고, 추후 API 연동 및 PWA 전환
- 프로젝트 경로: `/Users/leegyumin/Desktop/projects/adlips-frontend`
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
| Profile | `9633:16101` | 390×844 |
| Edit Profile | `10434:16978` | 390×844 |
| Friend | `10434:16458` | 390×844 |
| Search | `10766:19093` | 390×844 |
| Community | `10411:15680` | 390×844 |
| Making song (readonly) | `6779:12694` | 844×390 |

### 디자인 특성

- 기본 배경색: `#1d1d1d`
- 주요 포인트색: 보라색 계열 (`#4c00e5`, `#5b00f5`)
- 텍스트: `Paperlogy` 제목 스타일, `Pretendard` 본문 스타일
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
- `src/features/screens/`: 모바일 화면과 스튜디오 화면 컴포넌트
- `src/lib/api/`: 별도 백엔드 API 계약 및 공통 요청 클라이언트
- `src/lib/adlips-data.ts`: API 연결 전 목 데이터/타입
- `public/figma/`: Figma에서 다운로드한 원본 PNG/SVG 자산
- `.openai/hosting.json`: OpenAI Sites 프로젝트 연결 정보

### 구현된 화면 상태

`app/page.tsx`의 `View` 상태로 아래 화면을 전환한다.

- `home`: 인기 곡, 인기 글, 내 곡
- `charts`: 인기차트 목록
- `posts`: 인기글 목록
- `friends`: 팔로우 추천 및 팔로우 요청
- `search`: 검색 입력 및 임시 빈 결과
- `community`: 게시글/커뮤니티 탭과 게시글 피드
- `profile`: 프로필, 통계, 악기 태그, 설명, 작업물
- `edit`: 프로필 사진 및 입력 필드 편집 화면
- `studio`: 가로형 곡 제작 타임라인

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

- 서버 문서를 받은 뒤 `lib/adlips-data.ts`의 타입과 목 데이터를 API 응답 모델로 교체
- 화면별 데이터 패칭 로직을 UI 컴포넌트에서 분리
- 사용자 액션은 낙관적 업데이트와 실패 복구 상태를 함께 설계
- 인증 방식이 확정되면 보호 화면 및 토큰/세션 처리 추가
- 곡 제작 API는 일반 CRUD API와 오디오 업로드/스트리밍 계약을 분리해 설계
- API 연동 전에 단일 `View` 상태를 Next.js 라우트 구조로 이전할지 결정

## 7. 검증 상태

- Figma MCP 스크린샷과 로컬 390×844 화면을 비교해 주요 간격과 자산을 보정함
- 곡 제작 화면은 844×390 기준으로 비교함
- `npm run build` 성공
- 브라우저 콘솔 오류/경고 없음
- 로컬 미리보기는 `npm run dev`로 실행 가능

## 8. Git 상태

- 브랜치: `main`
- 원격: `origin` → `https://github.com/Team-Glitched/narackrock_frontend_v2.git`
- 최초 커밋: `bc74f26f558bc1b9e6f3f5ca0ca6ad1ba597309d`
- 커밋 메시지: `Initial commit`
- 최초 커밋은 `origin/main`에 푸시 완료
- 이 문서 추가분은 별도 커밋/푸시가 필요함

## 9. 배포 상태

- OpenAI Sites 프로젝트 ID가 `.openai/hosting.json`에 등록되어 있음
- Sites 배포는 아직 진행하지 않음
- GitHub 소스 업로드와 Sites 배포는 별도 절차로 취급

## 10. 작업 시 주의사항

- Figma 기준은 반드시 `v3`의 `Ready for dev` 프레임만 사용
- 기존 Figma 원본 자산을 우선 재사용하고 임의 아이콘으로 대체하지 않기
- 390×844 모바일 레이아웃과 844×390 작업 화면의 치수를 우선 보존
- API 문서가 오기 전에는 목 데이터 구조를 과도하게 확장하지 않기
- 사용자 요청 없이 인증, 데이터베이스, 소셜 공유 이미지 또는 완전한 PWA 기능을 선행 구현하지 않기
- `.openai/hosting.json`의 프로젝트 ID를 임의로 교체하거나 새 Sites 프로젝트를 중복 생성하지 않기
