export type Song = { id: number; title: string; artist: string; genre: string; accent: string };
export type Post = { id: number; author: string; title: string; body: string; likes: number; comments: number };
export type Creator = { id: number; name: string; instrument: string; mutual: boolean };

// API 연결 전 화면 개발용 데이터입니다. 추후 이 모듈의 export를
// 서버 응답 매퍼로 교체하면 UI 컴포넌트는 그대로 유지할 수 있습니다.
export const songs: Song[] = [
  { id: 1, title: "Midnight Signal", artist: "Muhehehe", genre: "Synth", accent: "#7c2cff" },
  { id: 2, title: "After the Rain", artist: "min chong", genre: "Indie", accent: "#ff496d" },
  { id: 3, title: "Neon Sunday", artist: "lilia", genre: "R&B", accent: "#24d6d1" },
  { id: 4, title: "Little Orbit", artist: "jayden", genre: "Pop", accent: "#ffca3a" },
  { id: 5, title: "Velvet Room", artist: "soyeon", genre: "Jazz", accent: "#ff6b35" },
  { id: 6, title: "Blue Hour", artist: "nara", genre: "Lo-fi", accent: "#56a7ff" },
];

export const posts: Post[] = [
  { id: 1, author: "min chong", title: "이거 좋냐?", body: "미안하다 이거 보여주려고 어그로끌었다. 새로 만든 후렴인데 의견 부탁해!", likes: 116, comments: 16 },
  { id: 2, author: "Muhehehe", title: "오늘 만든 베이스 라인", body: "8마디 루프를 다듬고 있어요. 다음 파트 아이디어를 같이 나눠요.", likes: 84, comments: 9 },
  { id: 3, author: "lilia", title: "새벽 작업실 플레이리스트", body: "작업할 때 자주 듣는 곡을 모았습니다. 여러분의 추천도 알려주세요.", likes: 52, comments: 11 },
];

export const creators: Creator[] = [
  { id: 1, name: "Muhehehe", instrument: "피아노", mutual: false },
  { id: 2, name: "lilia", instrument: "보컬", mutual: true },
  { id: 3, name: "min chong", instrument: "기타", mutual: true },
  { id: 4, name: "soyeon", instrument: "드럼", mutual: false },
];
