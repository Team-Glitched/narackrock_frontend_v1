"use client";
import "./opensource.css";
import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Navigate } from '@/features/navigation/types';
import { getCurrentUserId, subscribeCurrentUserId } from '@/lib/api/client';
import { openSourceApi as api, type OpenSourceDetail, type OpenSourceItem, type OpenSourceComment, type OpenSourcePublication } from '@/lib/api/opensource';
import { uploadMedia } from '@/lib/api/media';

const ProfileContext = createContext<(id: number) => void>(() => {});
const MutationContext = createContext<{ current: boolean } | null>(null);
const errorText = (error: unknown) => error instanceof Error ? error.message : '요청을 처리하지 못했습니다.';
export function OpensourceScreen({ go, onProfile, initialSearch = '', resolvePath = true }: { go: Navigate; onProfile?: (id: number) => void; initialSearch?: string; resolvePath?: boolean }) {
  const user = useSyncExternalStore(subscribeCurrentUserId, getCurrentUserId, () => null);
  return user == null ? <div className="scroll-content"><p>로그인 후 오픈소스를 이용할 수 있습니다.</p><button onClick={() => go('login')}>로그인</button></div> : <ProfileContext.Provider value={onProfile ?? (() => {})}><Workspace key={`${user}:${initialSearch}`} initialSearch={initialSearch} resolvePath={resolvePath} /></ProfileContext.Provider>;
}
export function OpensourceDetailScreen({ focusComments }: { focusComments?: boolean }) { return <div data-focus-comments={focusComments}><Workspace /></div>; }
function Workspace({ initialSearch = '', resolvePath = true }: { initialSearch?: string; resolvePath?: boolean }) {
  const onProfile = useContext(ProfileContext);
  const [tab, setTab] = useState<'feed' | 'saved' | 'mine' | 'create'>('feed');
  const [query, setQuery] = useState(initialSearch);
  const [search, setSearch] = useState(initialSearch);
  const [items, setItems] = useState<OpenSourceItem[]>([]);
  const [unavailable, setUnavailable] = useState<number[]>([]);
  const [publications, setPublications] = useState<OpenSourcePublication[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [editing, setEditing] = useState<OpenSourcePublication | null>(null);
  const [page, setPage] = useState(0);
  const [more, setMore] = useState(false);
  const [revision, setRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  useEffect(() => {
    const read = () => { const match = /^\/opensource\/([1-9]\d*)\/?$/.exec(window.location.pathname); const id = match ? Number(match[1]) : null; setSelected(id != null && Number.isSafeInteger(id) ? id : null); };
    if (resolvePath) read(); window.addEventListener('popstate', read); return () => window.removeEventListener('popstate', read);
  }, [resolvePath]);
  useEffect(() => {
    const token = ++generation.current;
    if (tab === 'create') return;
    const load = async () => {
      await Promise.resolve();
      if (token !== generation.current) return;
      setBusy(true); setError('');
      if (tab === 'mine') { const result = await api.publications(page); if (token !== generation.current) return; setPublications(old => page ? [...old, ...result.items.filter(x => !old.some(y => y.openSourceId === x.openSourceId))] : result.items); setMore(result.hasNext); }
      else if (tab === 'saved') { const result = await api.saved(page); if (token !== generation.current) return; const available = result.items.flatMap(x => x.source ? [x.source] : []); setItems(old => page ? [...old, ...available.filter(x => !old.some(y => y.openSourceId === x.openSourceId))] : available); setUnavailable(old => [...new Set([...(page ? old : []), ...result.items.filter(x => !x.source).map(x => x.openSourceId)])]); setMore(result.hasNext); }
      else { const result = await api.list(search, page); if (token !== generation.current) return; setItems(old => page ? [...old, ...result.items.filter(x => !old.some(y => y.openSourceId === x.openSourceId))] : result.items); setUnavailable([]); setMore(result.hasNext); }
    };
    void load().catch(e => { if (token === generation.current) setError(errorText(e)); }).finally(() => { if (token === generation.current) setBusy(false); });
    return () => { generation.current = token + 1; };
  }, [tab, search, page, revision]);
  const refresh = () => { setPage(0); setRevision(x => x + 1); };
  const open = (id: number) => { window.history.pushState({}, '', `/opensource/${id}`); setSelected(id); };
  if (selected) return <Detail key={selected} id={selected} back={() => { window.history.pushState({}, '', '/'); setSelected(null); refresh(); }} />;
  return <div className="opensource-view scroll-content">
    <nav aria-label="오픈소스 메뉴" style={{ display: 'flex', gap: 12, padding: 16 }}>{(['feed','saved','mine','create'] as const).map((value, i) => <button key={value} aria-pressed={tab === value} onClick={() => { setTab(value); setPage(0); setItems([]); setUnavailable([]); setPublications([]); setEditing(null); setMore(false); }}>{['탐색','보관함','내 등록','등록'][i]}</button>)}</nav>
    {tab === 'feed' && <form onSubmit={e => { e.preventDefault(); setSearch(query.trim()); setPage(0); }}><input aria-label="오픈소스 검색" value={query} onChange={e => setQuery(e.target.value)} maxLength={100} placeholder="제목 또는 설명 검색" /><button>검색</button></form>}
    {tab === 'create' || editing ? <PublicationForm key={editing?.openSourceId ?? 'new'} source={editing} done={() => { setEditing(null); setTab('mine'); refresh(); }} /> : <>
      {error && <p role="alert">{error}<button onClick={refresh}>재시도</button></p>}
      {tab === 'mine' ? publications.map(source => <article className="os-card" key={source.openSourceId}><h3>{source.title}</h3><p>{source.visibility === 'PUBLIC' ? '공개' : '비공개'}</p><button onClick={() => setEditing(source)}>관리</button></article>) : items.map(item => <article className="os-card" key={item.openSourceId}><button onClick={() => open(item.openSourceId)}><h3>{item.title}</h3><p>{item.description}</p></button><p><button onClick={() => onProfile(item.writer.userId)}>{item.writer.nickname}</button> · 사용 수 {item.usageCount}</p><p>추천 {item.likeCount} · 비추천 {item.dislikeCount} · 댓글 {item.commentCount}</p><Action label={item.isSaved ? '저장 해제' : '저장'} run={async () => { await api.save(item.openSourceId, !item.isSaved); refresh(); }} /></article>)}
      {tab === 'saved' && unavailable.map(id => <article className="os-card" key={id}><p>사용할 수 없는 오픈소스입니다.</p><Action label="저장 해제" run={async () => { await api.save(id, false); refresh(); }} /></article>)}
      {busy ? <p role="status">불러오는 중…</p> : !error && !(tab === 'mine' ? publications.length : items.length + unavailable.length) && <p>아직 항목이 없습니다.</p>}
      {more && <button disabled={busy} onClick={() => setPage(x => x + 1)}>더보기</button>}
    </>}
  </div>;
}
function Action({ label, run }: { label: string; run: () => Promise<unknown> }) {
  const ownLock = useRef(false); const sharedLock = useContext(MutationContext); const lock = sharedLock ?? ownLock; const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <><button disabled={busy} onClick={async () => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); try { await run(); } catch(e) { setError(errorText(e)); } finally { lock.current = false; setBusy(false); } }}>{label}</button>{error && <p role="alert">{error}</p>}</>;
}
function Detail({ id, back }: { id: number; back: () => void }) {
  const onProfile = useContext(ProfileContext); const mutation = useRef(false);
  const [source, setSource] = useState<OpenSourceDetail | null>(null); const [error, setError] = useState(''); const [revision, setRevision] = useState(0);
  const [playback, setPlayback] = useState<string | null>(null); const [comments, setComments] = useState<OpenSourceComment[]>([]); const [page, setPage] = useState(0); const [more, setMore] = useState(false);
  const [draft, setDraft] = useState(''); const [reply, setReply] = useState<number | undefined>();
  useEffect(() => { let active = true; void Promise.all([api.detail(id), Promise.all(Array.from({ length: page + 1 }, (_, index) => api.comments(id, index))).then(pages => ({ ...pages[pages.length - 1], comments: pages.flatMap(value => value.comments) }))]).then(([detail, result]) => { if (!active) return; setSource(detail); setComments(result.comments); setMore(result.hasNext); setError(''); }).catch(e => { if (active) setError(errorText(e)); }); return () => { active = false; }; }, [id, page, revision]);
  const refresh = () => setRevision(x => x + 1);
  return <MutationContext.Provider value={mutation}><div className="opensource-detail scroll-content"><button onClick={back}>목록으로</button>{error && <p role="alert">{error}<button onClick={refresh}>재시도</button></p>}{!source ? <p>불러오는 중…</p> : <>
    <h2>{source.title}</h2><p><button onClick={() => onProfile(source.writer.userId)}>{source.writer.nickname}</button> · {new Date(source.createdAt).toLocaleString()}</p><p>{source.description}</p><p>사용 수 {source.usageCount}</p>
    <Action label={source.isSaved ? '저장 해제' : '저장'} run={async () => { const result = await api.save(id, !source.isSaved); setSource(old => old ? { ...old, isSaved: result.isSaved } : old); }} />
    <Action label={`추천 ${source.likeCount}${source.isLiked ? ' ✓' : ''}`} run={async () => { try { const result = await api.react(id, 'likes'); setSource(old => old ? { ...old, ...result } : old); } catch (error) { setSource(await api.detail(id)); throw error; } }} />
    <Action label={`비추천 ${source.dislikeCount}${source.isDisliked ? ' ✓' : ''}`} run={async () => { try { const result = await api.react(id, 'dislikes'); setSource(old => old ? { ...old, ...result } : old); } catch (error) { setSource(await api.detail(id)); throw error; } }} />
    {source.canPreview && <Action label={playback ? '재생 링크 새로 받기' : '미리듣기'} run={async () => setPlayback((await api.playback(id)).audioUrl)} />}
    {playback && <audio key={playback} controls autoPlay src={playback} onError={() => setError('음원을 재생할 수 없습니다. 재생 링크를 새로 받아 주세요.')} style={{ width: '100%' }} />}
    <Action label="공유" run={async () => { const { shareUrl } = await api.share(id); if (navigator.share) { try { await navigator.share({ title: source.title, url: shareUrl }); } catch(e) { if (!(e instanceof DOMException && e.name === 'AbortError')) throw e; } } else { await navigator.clipboard.writeText(shareUrl); } }} />
    <h3>댓글 {source.commentCount}</h3>
    {comments.map(comment => <Comment key={`${comment.commentId}:${revision}`} comment={comment} sourceId={id} reply={() => setReply(comment.commentId)} />)}
    {more && <button onClick={() => setPage(x => x + 1)}>댓글 더보기</button>}
    {reply && <p>선택한 댓글에 답글 작성 <button onClick={() => setReply(undefined)}>취소</button></p>}
    <textarea aria-label="댓글 내용" value={draft} onChange={e => setDraft(e.target.value)} />
    <Action label="게시" run={async () => { const text = draft.trim(); if (!text || [...text].length > 1000) throw new Error('댓글은 1~1000자로 입력해 주세요.'); await api.comment(id, text, reply); setDraft(''); setReply(undefined); setPage(0); refresh(); }} />
  </>}</div></MutationContext.Provider>;
}
function Comment({ comment, sourceId, reply }: { comment: OpenSourceComment; sourceId: number; reply?: () => void }) {
  const onProfile = useContext(ProfileContext); const [item, setItem] = useState(comment); const [replies, setReplies] = useState<OpenSourceComment[]>([]); const [page, setPage] = useState(0); const [more, setMore] = useState(comment.replyCount > 0);
  return <article className="os-detail-comment"><button onClick={() => onProfile(item.writer.userId)}>{item.writer.nickname}</button><p>{item.content}</p><small>{new Date(item.createdAt).toLocaleString()}</small>{reply && <button onClick={reply}>답글 작성</button>}{(['likes','dislikes'] as const).map(vote => <Action key={vote} label={`${vote === 'likes' ? '추천' : '비추천'} ${vote === 'likes' ? item.likeCount : item.dislikeCount}`} run={async () => { try { const result = await api.reactComment(item.commentId, vote); setItem(old => ({ ...old, ...result })); } catch (error) { let next = 0; let hasNext = true; while (hasNext) { const result = await api.comments(sourceId, next++, item.parentCommentId ?? undefined); const current = result.comments.find(value => value.commentId === item.commentId); if (current) { setItem(current); break; } hasNext = result.hasNext; } throw error; } }} />)}
    {replies.map(child => <Comment key={child.commentId} comment={child} sourceId={sourceId} />)}
    {more && <Action label="답글 더보기" run={async () => { const result = await api.comments(sourceId, page, item.commentId); setReplies(old => [...old, ...result.comments.filter(x => !old.some(y => y.commentId === x.commentId))]); setMore(result.hasNext); setPage(x => x + 1); }} />}
  </article>;
}
function PublicationForm({ source, done }: { source: OpenSourcePublication | null; done: () => void }) {
  const [title, setTitle] = useState(source?.title ?? ''); const [description, setDescription] = useState(source?.description ?? ''); const [file, setFile] = useState<File | null>(null); const [confirm, setConfirm] = useState(false); const [thumbnail, setThumbnail] = useState<File | null>(null); const uploaded = useRef<{ file: File; id: number } | null>(null);
  return <section><h2>{source ? '등록 관리' : '오픈소스 등록'}</h2><label>제목<input value={title} onChange={e => setTitle(e.target.value)} /></label><label>설명<textarea value={description} onChange={e => setDescription(e.target.value)} /></label>{!source && <label>음원<input type="file" accept="audio/*" onChange={e => setFile(e.target.files?.[0] ?? null)} /></label>}
    <label>썸네일<input type="file" accept="image/*" onChange={e => setThumbnail(e.target.files?.[0] ?? null)} /></label><Action label="저장" run={async () => { if (![...title.trim()].length || [...title.trim()].length > 100 || [...description].length > 2000) throw new Error('제목은 1~100자, 설명은 2000자 이내로 입력해 주세요.'); const thumbnailMediaFileId = thumbnail ? await uploadMedia(thumbnail, 'IMAGE') : undefined; if (source) await api.update(source.openSourceId, { title: title.trim(), description, thumbnailMediaFileId }); else { if (!file) throw new Error('음원을 선택해 주세요.'); const mediaFileId = uploaded.current?.file === file ? uploaded.current.id : await uploadMedia(file, 'AUDIO'); uploaded.current = { file, id: mediaFileId }; await api.create({ title: title.trim(), description, mediaFileId, thumbnailMediaFileId }); } done(); }} />
    {source && <><Action label={source.visibility === 'PUBLIC' ? '공개 철회' : '공개하기'} run={async () => { await api.visibility(source.openSourceId, source.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC'); done(); }} /><button onClick={() => setConfirm(true)}>삭제</button>{confirm && <div><p>이 오픈소스를 삭제하시겠습니까?</p><Action label="삭제 확인" run={async () => { await api.remove(source.openSourceId); done(); }} /><button onClick={() => setConfirm(false)}>취소</button></div>}</>}
  </section>;
}
