import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createModerationApi } from './community-moderation.ts';

test('management deletion uses PATCH with reason and handles missing data', async () => {
  const calls = [];
  const api = createModerationApi(async (path, init) => { calls.push({ path, init }); return { success: true }; });
  await api.deleteContent(12, 'comment', 45, '운영 정책 위반');
  assert.equal(calls[0].path, '/api/v1/galleries/12/manage/comments/45/delete');
  assert.equal(calls[0].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[0].init.body), { reason: '운영 정책 위반' });
});

test('cursor and false activeOnly are preserved; user search uses page not cursor', async () => {
  const calls = [];
  const api = createModerationApi(async path => { calls.push(path); return { data: {} }; });
  await api.bans(9, 31, false);
  await api.searchUsers('민 수', 2);
  assert.equal(calls[0], '/api/v1/galleries/9/manage/bans?size=20&activeOnly=false&cursor=31');
  assert.equal(calls[1], '/api/v1/users/search?keyword=%EB%AF%BC+%EC%88%98&page=2&size=20');
});

test('expulsion never sends suspension duration; suspension preserves chosen days', async () => {
  const bodies = [];
  const api = createModerationApi(async (_, init) => { bodies.push(JSON.parse(init.body)); return { data: { banId: 4 } }; });
  await api.sanction(1, 2, 'EXPEL', '사유', 30);
  await api.sanction(1, 2, 'SUSPEND', '사유', 7);
  assert.deepEqual(bodies[0], { userId: 2, type: 'EXPEL', reason: '사유' });
  assert.deepEqual(bodies[1], { userId: 2, type: 'SUSPEND', reason: '사유', durationDays: 7 });
});

test('failures propagate without retry or pretending duplicate mutations succeeded', async () => {
  let calls = 0;
  const failure = Object.assign(new Error('이미 처리됨'), { status: 409 });
  const api = createModerationApi(async () => { calls++; throw failure; });
  await assert.rejects(api.approve(3), error => error === failure);
  assert.equal(calls, 1);
});

test('reporting and resolving are separate endpoints with explicit ban duration', async () => {
  const calls = [];
  const api = createModerationApi(async (path, init) => { calls.push([path, JSON.parse(init.body)]); return { data: {} }; });
  await api.report('comment', 4, '사유');
  await api.resolveReport(7, 'BAN_USER', '정지 사유', 14);
  assert.deepEqual(calls, [
    ['/api/v1/posts/comments/4/reports', { reason: '사유' }],
    ['/api/v1/admin/reports/7/resolve', { actionType: 'BAN_USER', reason: '정지 사유', banDurationDays: 14 }],
  ]);
});

test('never accidentally turns a missing duration into a permanent service ban', async () => {
  let called = false;
  const api = createModerationApi(async () => { called = true; return { data: {} }; });
  await assert.rejects(async () => api.resolveReport(1, 'BAN_USER', '사유'), RangeError);
  await assert.rejects(async () => api.sanction(1, 2, 'SUSPEND', '사유', 0), RangeError);
  await assert.rejects(async () => api.sanction(1, 2, 'SUSPEND', '사유', 31), RangeError);
  assert.equal(called, false);
});
