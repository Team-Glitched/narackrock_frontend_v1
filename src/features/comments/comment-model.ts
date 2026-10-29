export type CommentItem = {
  id: number; parentId: number | null; userId: number; author: string;
  avatarUrl: string | null; text: string; time: string; replyCount: number; likes: number;
};
export type CommentPage = { items: CommentItem[]; total: number; page: number };
export type CommentAdapter = {
  load: (parentId: number | null, page: number) => Promise<CommentPage>;
  create: (text: string, parentId: number | null) => Promise<unknown>;
  update: (id: number, text: string) => Promise<unknown>;
  remove: (id: number) => Promise<unknown>;
};
