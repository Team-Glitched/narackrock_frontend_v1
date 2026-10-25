# 원클릭 코드 입력 실제 로컬 연동 검증

검증일: 2026-10-25 (한국 시간)

## 실행 환경

- 프론트엔드: `Feature/one-click-chords`, `http://localhost:5184`
- 백엔드: `origin/TEST` (`f0b4178`), `local-test` 프로필, `127.0.0.1:8081`
- Java: JDK 21
- DB: 독립 H2 파일 `/private/tmp/adlips-one-click-chords-db.mv.db`
- 업로드: `/private/tmp/adlips-one-click-chords-uploads`
- Redis: `adlips-one-click-chords-redis`, `127.0.0.1:16381`
- Chrome에서 실제 프론트엔드와 백엔드를 사용했다. API 모의 응답을 사용하지 않았다.
- 인증 헤더 없이 `TEST`의 루프백 인증 우회 및 자동 생성 사용자 1을 사용했다.

기존 작업 디렉터리, 개발 DB 및 Redis 데이터는 변경하지 않았다.

## 확인 결과

모든 항목이 통과했다.

1. 브라우저에서 빈 곡과 피아노 트랙을 생성하고 C 버튼으로 C4·E4·G4를 동시에 입력했다.
2. 같은 위치의 C를 다시 눌러도 노트가 늘어나지 않고 중복 안내가 표시됐다.
3. C → Cm7 → Csus4 → F#maj7을 네 마디에 입력했다. 실제 MIDI 생성 POST는 201이며,
   별도의 실제 GET으로 14개 음의 피치·시작 위치·길이가 일치함을 확인했다.
4. 실제 MP3 샘플을 디코딩한 Web Audio 재생을 확인했다. 0·2·4·6초 위치에서 각각
   3·4·3·4개 음의 소스가 동시에 시작했고, 출력 신호의 최대 절댓값은 약 0.114였다.
   8초 분량의 마지막 노트가 끝나면 재생이 정지했다.
5. 옥타브 5, 길이 1/4의 C 코드를 추가했다. 실제 PATCH는 200이며,
   브라우저 전체 새로고침 → 이전 작업 이어하기 → MIDI 편집으로 17개 음이 복원됐다.
6. 390×844 화면에서 문서의 가로 넘침이 없었다.
7. 별도 MIDI 클립에서 12개 반음계 근음을 모두 클릭하고 저장했다.
   실제 GET으로 36개 음의 메이저 코드 구성음과 격자 위치가 정확함을 확인했다.

검증 중 브라우저에서 관찰한 API 요청 18건은 모두 200 또는 201이었다.
브라우저 실행 오류는 0건이었다. 백엔드 `/actuator/health`는 `UP`이었다.

## 재실행 설정

백엔드 `TEST` 체크아웃에서 실행한다. 동일한 DB를 동시에 여는 서버가 없어야 한다.

```sh
docker run --pull=never -d --name adlips-one-click-chords-redis \
  -p 127.0.0.1:16381:6379 redis:8.10.1-alpine

JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-21.jdk/Contents/Home \
./gradlew --no-daemon bootRun --args='--spring.profiles.active=local-test --server.address=127.0.0.1 --spring.datasource.url=jdbc:h2:file:/private/tmp/adlips-one-click-chords-db;MODE=MySQL;DATABASE_TO_LOWER=TRUE --app.storage.local-root=/private/tmp/adlips-one-click-chords-uploads --spring.data.redis.port=16381 --spring.data.redis.password='
```

Redis 컨테이너가 이미 존재한다면 `docker start adlips-one-click-chords-redis`로 재사용한다.

프론트엔드 기능 브랜치에서 실행한다. `/api` 요청을 로컬 백엔드로 프록시한다.

```sh
NEXT_PUBLIC_API_BASE_URL= \
NARACKROCK_API_PROXY_TARGET=http://127.0.0.1:8081 \
npm run dev -- --port 5184
```

화면에서 `곡 만들기 → 빈 곡에서 시작 → 노트로 작곡`을 선택하면 코드 입력을 사용할 수 있다.

## 근음별 코드 선택 팝업 검증 (2026-10-26)

툴바의 `코드로 추가` 버튼으로 팝업을 연다. C, C#/Db, D 등의 근음별로
12종씩 총 144개 코드를 표시하며, 근음 바로가기로 원하는 그룹으로 이동한다.
옥타브와 노트 길이는 팝업에서 선택한다. 코드 입력이 성공하면 팝업이 닫히고,
중복 등의 오류가 있으면 팝업 안에 안내한다. 팝업을 열 때 진행 중인 재생은 일시정지한다.

같은 실제 TEST 백엔드 환경에서 다음을 확인했다.

- 팝업을 통한 C·Cm7·Csus4·F#maj7 입력, POST 저장, GET 재조회
- 14개 음의 실제 샘플 재생 및 코드 구성음의 동시 시작
- 옥타브·길이 변경, PATCH 저장, 전체 새로고침 후 노트 복원
- 12개 근음 그룹 및 그룹당 12개 코드 표시, 근음 바로가기 이동
- 팝업 내부 키보드 포커스 유지, Esc·닫기 버튼·배경 클릭으로 닫기, 트리거로 포커스 복귀
- 390×844 및 320×640에서 팝업이 화면 경계 안에 표시되고 목록을 스크롤할 수 있음
- 높은 옥타브에서 MIDI 음역을 벗어나는 코드의 비활성화
- 12개 근음 버튼으로 36개 구성음 입력 및 실제 DB 저장

API 요청 18건은 모두 성공했고 브라우저 실행 오류는 0건이었다.
전체 자동화 테스트 67개, 타입 검사, 변경 파일 린트 및 프로덕션 빌드도 통과했다.
