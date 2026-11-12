const RECENT_TITLE_LIMIT = 20;

const standaloneTitles = [
  "누구의 삶인들 향기롭지 않으랴",
  "우리 사이에 남은 한 소절",
  "기타 줄을 갈던 오후",
  "반쯤 깨어 있는 도시",
  "별일 없는 날의 기적",
  "파도가 잠든 시간",
  "그때 우리는 후렴을 몰랐다",
  "첫눈보다 먼저 온 노래",
  "비가 그친 뒤의 합주",
  "너의 계절은 몇 박자였을까",
  "다시 만나면 꼭 들려줄게",
  "나의 가장 작은 오케스트라",
  "오늘은 조금 느리게",
  "불을 끄면 들리는 것들",
  "쉼표에도 마음이 있다면",
  "노을을 접어 주머니에",
  "아무도 기다리지 않는 엔딩",
  "우리가 틀린 곳부터 다시",
];

// Each group combines complete Korean phrases with the same grammatical form.
const titlePatterns = [
  {
    starts: [
      "오래된 골목의", "낯선 도시의", "작은 다락방의", "불 꺼진 극장의", "바닷가 마을의",
      "아무도 없는 역의", "깊은 숲의", "낮잠 든 오후의", "새벽 주방의", "오래된 사진 속의",
      "한여름 밤의", "초겨울 아침의", "느린 일요일의", "안개 낀 항구의", "비 오는 거리의",
      "버스 창가의", "빈 연습실의", "먼 바다의", "노을 진 옥상의", "다시 돌아온 봄의",
    ],
    ends: [
      "작은 멜로디", "느린 박자", "잊힌 화음", "마지막 소절", "낮은 울림",
      "긴 여운", "숨겨진 리듬", "낡은 테이프", "흩어진 음표", "조용한 후렴",
      "짧은 세레나데", "미완성 노래", "오래된 약속", "희미한 잔향", "느린 왈츠",
      "잊지 못한 장면", "다정한 인사", "한 줄의 편지", "연습곡", "두 번째 테이크",
    ],
  },
  {
    starts: [
      "비가", "바람이", "새벽이", "노을이", "햇살이",
      "여름이", "가을이", "겨울이", "봄이", "저녁이",
      "달빛이", "별빛이", "물결이", "구름이", "첫눈이",
      "안개가", "파도가", "그림자가", "가로등 불빛이", "도시의 소음이",
    ],
    ends: [
      "노래가 되는 순간", "한 박자 쉬어 갈 때", "조용히 내려앉는 밤", "멀어지기 전에", "우리 곁에 머문다면",
      "기억에 닿을 때", "지나간 자리", "후렴처럼 돌아올 때", "잠시 멈춰 선 곳", "오늘을 데려가면",
      "들려준 이야기", "남기고 간 멜로디", "잊혀지기 전에", "춤추던 장면", "불러온 계절",
      "만들어 낸 화음", "가만히 건넨 인사", "잠드는 시간", "느리게 흐르는 날", "열어 준 다음 장",
    ],
  },
  {
    starts: [
      "첫차를 기다리며", "마지막 버스를 타고", "창문을 열어 두고", "파도 소리를 들으며", "빈 거리를 걸으며",
      "모퉁이에 잠시 서서", "낡은 기타를 안고", "조용한 새벽에", "우산 없이 걸으며", "커피가 식는 동안",
      "별을 세어 보며", "불을 끈 뒤에", "테이프를 되감으며", "먼 곳을 바라보며", "노을을 따라 걷다가",
      "이어폰을 나눠 끼고", "첫눈을 기다리며", "눈을 감은 채", "집으로 돌아오는 길에", "아무도 모르게",
    ],
    ends: [
      "떠올린 멜로디", "적어 둔 한 줄", "들려주고 싶은 이야기", "주워 모은 음표", "그려 본 내일",
      "만들어 본 리듬", "흥얼거린 후렴", "기억해 낸 노래", "발견한 쉼표", "되찾은 박자",
      "써 내려간 첫 마디", "녹음한 작은 소리", "마음에 담은 장면", "조용히 건넨 인사", "고른 마지막 화음",
      "미뤄 둔 엔딩", "완성한 짧은 편지", "기다린 대답", "생각해 낸 첫 소절", "다시 펼친 악보",
    ],
  },
  {
    starts: [
      "지난여름을", "오래된 노래를", "어젯밤을", "첫눈을", "지나간 계절을",
      "바다를", "비의 소리를", "너의 목소리를", "낯선 도시를", "마지막 장면을",
      "잊힌 멜로디를", "빈자리를", "새벽 공기를", "짧았던 봄을", "옛 약속을",
      "우리가 걷던 길을", "그날의 노을을", "낮은 파도 소리를", "서툰 인사를", "조용한 아침을",
    ],
    ends: [
      "다시 듣는 밤", "기억하는 법", "조금 늦게 떠올리며", "악보에 옮겨 적다", "가만히 꺼내 보다",
      "한 소절로 남기다", "노래로 건네다", "아직도 기억해", "마음 한쪽에 두고", "화음으로 그리다",
      "천천히 불러 보다", "오늘까지 데려오다", "다시 만나는 시간", "반복해서 듣는 이유", "잊지 않기 위해",
      "짧은 곡에 담아", "나만의 속도로 기억해", "한 번 더 떠올리다", "가장 가까이 두고", "처음처럼 마주하다",
    ],
  },
  {
    starts: [
      "바람보다", "봄비보다", "늦은 편지보다", "꿈보다", "파도보다",
      "구름보다", "기억보다", "발자국보다", "별빛보다", "달빛보다",
      "낮잠보다", "인사보다", "한숨보다", "속삭임보다", "마지막 버스보다",
      "초침보다", "책장 넘기는 소리보다", "옛 노래보다", "눈발보다", "새벽 공기보다",
    ],
    ends: [
      "느린 박자", "오래 남은 울림", "짧은 이야기", "조용한 후렴", "느리게 번지는 화음",
      "낮은 멜로디", "가벼운 마음", "멀리 간 소리", "희미한 기억", "부드러운 리듬",
      "조금 긴 여운", "한발 앞선 노래", "다정한 위로", "선명한 장면", "쉽게 잊히지 않는 밤",
      "작은 떨림", "천천히 닿는 인사", "늦게 온 대답", "오래 머무는 소절", "먼저 도착한 마음",
    ],
  },
];

export const PROJECT_TITLE_SUGGESTIONS = [...new Set([
  ...standaloneTitles,
  ...titlePatterns.flatMap(({ starts, ends }) => starts.flatMap((start) => ends.map((end) => `${start} ${end}`))),
])];

export function chooseProjectTitle(recent: readonly string[], random = Math.random): string {
  const excluded = new Set(recent);
  const available = PROJECT_TITLE_SUGGESTIONS.filter((title) => !excluded.has(title));
  const pool = available.length > 0 ? available : PROJECT_TITLE_SUGGESTIONS;
  return pool[Math.floor(random() * pool.length)];
}

export function withRecentProjectTitle(recent: readonly string[], title: string): string[] {
  return [title, ...recent.filter((entry) => entry !== title)].slice(0, RECENT_TITLE_LIMIT);
}

export function projectTitleHistoryKey(origin: string, userId: number | null): string {
  return `narackrock.project-title-history:${origin}:${userId ?? "guest"}`;
}

export function readRecentProjectTitles(key: string): string[] {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(key) ?? "[]");
    return Array.isArray(stored)
      ? stored.filter((title): title is string => typeof title === "string").slice(0, RECENT_TITLE_LIMIT)
      : [];
  } catch {
    return [];
  }
}

export function rememberProjectTitle(key: string, title: string): void {
  try {
    const recent = withRecentProjectTitle(readRecentProjectTitles(key), title);
    window.localStorage.setItem(key, JSON.stringify(recent));
  } catch {
    // Suggestions still work when browser storage is unavailable.
  }
}
