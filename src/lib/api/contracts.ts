export type SongDto = { id: string; title: string; artistName: string; coverUrl: string | null };
export type PostDto = { id: string; authorName: string; title: string; body: string; imageUrl: string | null; likes: number; comments: number };
export type UserDto = { id: string; displayName: string; avatarUrl: string | null };
