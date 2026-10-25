import assert from "node:assert/strict";
import test from "node:test";
import { previewRequest } from "../../features/preview/demo-api.ts";

const data = async (path, init) => (await previewRequest(path, init)).data;
const write = (content, parentCommentId = null) => ({ method: "POST", body: JSON.stringify({ content, parentCommentId }) });

test("preview comments stay within their post and reply thread through edits and deletion", async () => {
  const original = await data("/api/v1/posts/1/comments");
  assert.ok(original.comments.every(comment => comment.parentCommentId === null));
  const parent = original.comments[0];
  const repliesBefore = await data(`/api/v1/posts/1/comments?parentCommentId=${parent.commentId}`);
  const created = await data("/api/v1/posts/1/comments", write("thread isolation", parent.commentId));
  const repliesAfter = await data(`/api/v1/posts/1/comments?parentCommentId=${parent.commentId}`);
  assert.equal(repliesAfter.totalCount, repliesBefore.totalCount + 1);
  assert.ok(repliesAfter.comments.some(comment => comment.commentId === created.commentId));
  const topLevel = await data("/api/v1/posts/1/comments");
  assert.ok(!topLevel.comments.some(comment => comment.commentId === created.commentId));
  assert.equal(topLevel.comments.find(comment => comment.commentId === parent.commentId).replyCount, parent.replyCount + 1);
  const otherPost = await data("/api/v1/posts/2/comments");
  assert.ok(!otherPost.comments.some(comment => comment.commentId === created.commentId));
  await assert.rejects(() => data("/api/v1/posts/2/comments", write("wrong parent", parent.commentId)));
  await data(`/api/v1/posts/comments/${created.commentId}`, { method: "PUT", body: JSON.stringify({ content: "edited reply" }) });
  assert.equal((await data(`/api/v1/posts/1/comments?parentCommentId=${parent.commentId}`)).comments.find(comment => comment.commentId === created.commentId).content, "edited reply");
  await data(`/api/v1/posts/comments/${created.commentId}`, { method: "DELETE" });
  assert.equal((await data(`/api/v1/posts/1/comments?parentCommentId=${parent.commentId}`)).totalCount, repliesBefore.totalCount);
  await assert.rejects(() => data(`/api/v1/posts/comments/${parent.commentId}`, { method: "DELETE" }));
});


test("preview profile requests resolve the requested identity without changing the signed-in profile", async () => {
  const own = await data("/api/v1/users/profiles/1");
  const author = await data("/api/v1/users/profiles/2");
  const friend = await data("/api/v1/users/profiles/3");
  assert.equal(own.userId, 1);
  assert.equal(author.userId, 2);
  assert.equal(author.nickname, "min chong");
  assert.equal(friend.userId, 3);
  assert.equal(friend.nickname, "Muhehehe");
  assert.equal((await data("/api/v1/users/profiles/1")).nickname, own.nickname);
});
