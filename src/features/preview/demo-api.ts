import type { CompositionDto, ClipDto } from "../../lib/api/composition";
import { canMoveClip, overlapsClip } from "../composition/timeline-move.ts";
import { canManageCommunityMember, isCommunityOwner } from "../admin/permissions.ts";
import type { GalleryListItem, PostDetailResponse, PostComment, ShortItemDto, UserProfile } from "../../lib/api/contracts";

const date = new Date().toISOString();
const author = { userId: 2, nickname: "min chong", profileImageUrl: "/figma/profile.png" };
const page = { nextCursor: null, hasMore: false, size: 3 };
const envelope = <T,>(data: T) => ({ success: true, message: "미리보기", data });
let sequence = 100;
const media = new Map<number, string>();
const projects = new Map<number, CompositionDto>();
const subscribed = new Set([1, 2, 3]);
const comments: (PostComment & { postId: number })[] = Array.from({ length: 6 }, (_, postIndex) => {
  const postId = postIndex + 1;
  const commentId = 1000 + postId * 10;
  return [
    { postId, commentId, parentCommentId: null, writer: author, content: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", replyCount: 1, createdAt: date },
    { postId, commentId: commentId + 1, parentCommentId: commentId, writer: author, content: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", replyCount: 0, createdAt: date },
    { postId, commentId: commentId + 2, parentCommentId: null, writer: author, content: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", replyCount: 2, createdAt: date },
    { postId, commentId: commentId + 3, parentCommentId: commentId + 2, writer: author, content: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", replyCount: 0, createdAt: date },
    { postId, commentId: commentId + 4, parentCommentId: commentId + 2, writer: author, content: "이거 아무튼 댓글이긴한데 댓글이 아닌거 같기도 하고", replyCount: 0, createdAt: date },
  ];
}).flat();
const posts: PostDetailResponse[] = Array.from({ length: 6 }, (_, i) => ({ postId: i + 1, gallery: { galleryId: 1, name: "Muhehehe" }, writer: author, title: "이거 좋나?", content: "미안하다 이거 보여주려고 어그로끌었다.. 나루도 사스케 싸움수준 ㄹㅇ실화냐? 진...", imageUrl: "/figma/post-photo-placeholder.svg", viewCount: 116, likeCount: 5, dislikeCount: 0, commentCount: 5, isLiked: false, isDisliked: false, createdAt: date, updatedAt: null }));
const shorts: ShortItemDto[] = ["Pretender", "함께 만든 멜로디", "나의 첫 번째 곡"].map((title, i) => ({ shortId: i + 1, projectId: i + 1, title, mediaUrl: null, albumImageUrl: i === 0 ? "/figma/abyss-album.png" : null, completionStatus: "IN_PROGRESS", viewCount: 116, likeCount: 116, dislikeCount: 0, commentCount: 116, contributionCount: 3, isLiked: false, isDisliked: false, isBookmarked: false, hasPendingContribution: false, hasApprovedContribution: false, author, participants: [{ ...author, role: "CREATOR" }], createdAt: date }));
const galleries: GalleryListItem[] = Array.from({length:8},(_,i)=>({galleryId:i+1,ownerId:i===0?1:2,name:"Muhehehe",description:"이곳은 Muhehe를 찬성하는 곳입니다",subscriberCount:i===0?6:100,createdAt:date}));
export function createPreviewCommunity(name:string,description:string,imageUrl:string|null):GalleryListItem {
  if(!name.trim())throw new Error("커뮤니티 이름을 입력해주세요.");
  const gallery={galleryId:++sequence,name:name.trim(),description:description.trim(),imageUrl,ownerId:1,subscriberCount:1,createdAt:new Date().toISOString()};
  galleries.unshift(gallery);return gallery;
}
export type PreviewCommunityMember = { userId:number; nickname:string; profileImageUrl:string|null; instrument:string|null; suspendedUntil?:string; reason?:string };
const communityMembers = new Map<number,PreviewCommunityMember[]>();
function ownedPreviewCommunity(galleryId:number,userId:number|null) {
  const gallery=galleries.find(item=>item.galleryId===galleryId);
  if(!gallery||!isCommunityOwner(gallery,userId))throw new Error("커뮤니티 관리자만 사용할 수 있습니다.");
  return gallery;
}
export function getPreviewCommunityMembers(galleryId:number,userId:number|null) {
  const gallery=ownedPreviewCommunity(galleryId,userId);
  if(!communityMembers.has(galleryId))communityMembers.set(galleryId,galleryId===1
    ? [1,2,3,4,5,6].map((id)=>({userId:id,nickname:id===1?"oii_aio_iiiiai":id===2?"min chong":id===3?"Muhehehe":`사용자 ${id}`,profileImageUrl:"/figma/profile.png",instrument:id%2?"Piano":"Guitar"}))
    : [{userId:gallery.ownerId!,nickname:"oii_aio_iiiiai",profileImageUrl:"/figma/profile.png",instrument:null}]);
  return communityMembers.get(galleryId)!.map(member=>({...member}));
}
export function moderatePreviewCommunityMember(galleryId:number,userId:number|null,memberId:number,action:"suspend"|"expel",reason:string,days=30) {
  const gallery=ownedPreviewCommunity(galleryId,userId);
  if(!canManageCommunityMember(gallery,userId,memberId))throw new Error("커뮤니티 개설자는 제재할 수 없습니다.");
  if(!reason.trim())throw new Error("사유를 입력해주세요.");
  if(action==="suspend"&&(!Number.isInteger(days)||days<1||days>365))throw new Error("이용정지 기간은 1일부터 365일까지 입력해주세요.");
  const members=getPreviewCommunityMembers(galleryId,userId);
  const member=members.find(item=>item.userId===memberId);
  if(!member)throw new Error("멤버를 찾을 수 없습니다.");
  if(action==="expel") { communityMembers.set(galleryId,members.filter(item=>item.userId!==memberId));gallery.subscriberCount=Math.max(1,gallery.subscriberCount-1); }
  else { member.suspendedUntil=new Date(Date.now()+days*86400000).toISOString();member.reason=reason.trim();communityMembers.set(galleryId,members); }
}
export function moderatePreviewCommunityPost(galleryId:number,userId:number|null,postId:number) {
  ownedPreviewCommunity(galleryId,userId);
  const index=posts.findIndex(post=>post.postId===postId&&post.gallery.galleryId===galleryId);
  if(index<0)throw new Error("이 커뮤니티의 게시글을 찾을 수 없습니다.");
  posts.splice(index,1);
}
const profile: UserProfile = { userId: 1, nickname: "oii_aio_iiiiai", profileImageUrl: "/figma/profile.png", explanation: "안녕하십니까 저는 지금 SO MUHEHE 합니다 하지만 모든것이 MUHEHE할순 없겠죠 hahahahahahahadfsgdsfsfsadfasdfdsafasdfsadfdsafdas", primaryInstrument: "Guitar, Piano, Wa Sans", relations: { followerCount: 12000, followingCount: 12000, isFollowing: false }, activities: { postCount: 12000, posts: posts.map(p => ({ postId: p.postId, title: p.title, thumbnailUrl: p.imageUrl })), participatedShorts: shorts, pinnedShorts: shorts.map((s, i) => ({ ...s, displayOrder: i })) } };
function newProject(id: number): CompositionDto {
  return { viewerPermission: { userId: 1, canEdit: true, canContribute: true, canReviewContribution: true, canExport: true }, project: { projectId: id, title: "제목 없는 곡", albumImageFileId: null, bpm: 120, ppq: 480, maxTick: 57600, maxDurationMs: 60000, status: "DRAFT", isPublic: false, version: { major: 1, minor: 0, display: "1.0" } }, tracks: [] };
}
function project(id: number) {
  if (!projects.has(id)) {
    const value = newProject(id);
    value.project.title = shorts.find(s => s.projectId === id)?.title ?? "제목 없는 곡";
    if (id < 100) value.tracks = ["Piano", "Bass", "Synth"].map((name, i) => ({ trackId: id * 10 + i, ownerId: 2, name, instrument: "piano", volume: 70, isMuted: false, isSolo: false, approvalStatus: "APPROVED", clips: [{ clipId: id * 10 + i, ownerId: 2, clipType: "MIDI", sourceType: "MIDI_INPUT", mediaFileId: null, mediaUrl: null, startTick: 0, durationTick: 3840 + i * 1920, startTimeMs: 0, durationMs: 4000 + i * 2000, clipOffsetMs: 0, approvalStatus: "APPROVED", midiNotes: [60,64,67,72].map((pitch, n) => ({ pitch: pitch - i * 12, startTick: n * 480, durationTick: 360, velocity: 80, effectType: null, effectParams: {} })) }] }));
    projects.set(id, value);
  }
  return projects.get(id)!;
}
function persist() {
  try { sessionStorage.setItem("narackrock.preview.projects", JSON.stringify({ sequence, projects: [...projects] })); } catch { /* In-memory editing remains available. */ }
}
let restored = false;
function restore() {
  if (restored) return;
  restored = true;
  try { const saved = JSON.parse(sessionStorage.getItem("narackrock.preview.projects") ?? "null"); if (saved?.projects) { for (const [id, data] of saved.projects) projects.set(id, data); sequence = saved.sequence; } } catch { /* Start a new preview if the snapshot is malformed. */ }
}
function renderAudio(value: CompositionDto) {
  const rate = 22050;
  const { bpm, ppq } = value.project;
  const secondsPerTick = 60 / bpm / ppq;
  const length = Math.min(60, Math.max(1, ...value.tracks.flatMap(t => t.clips.map(c => (c.startTick + c.durationTick) * secondsPerTick)))) + 0.3;
  const samples = new Float32Array(Math.ceil(length * rate));
  for (const track of value.tracks) for (const clip of track.clips) for (const note of clip.midiNotes) {
    const start = Math.round((clip.startTick + note.startTick) * secondsPerTick * rate);
    const duration = Math.round(note.durationTick * secondsPerTick * rate);
    const frequency = 440 * 2 ** ((note.pitch - 69) / 12);
    for (let i = 0; i < duration && start + i < samples.length; i++) {
      const envelope = Math.min(i / (rate * .01), 1, (duration - i) / (rate * .04));
      samples[start + i] += Math.sin(2 * Math.PI * frequency * i / rate) * envelope * .12 * note.velocity / 127;
    }
  }
  const bytes = new ArrayBuffer(44 + samples.length * 2), view = new DataView(bytes);
  const label = (offset: number, text: string) => [...text].forEach((c, i) => view.setUint8(offset + i, c.charCodeAt(0)));
  label(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); label(8, "WAVEfmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true); label(36, "data"); view.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, i) => view.setInt16(44 + i * 2, Math.max(-1, Math.min(1, sample)) * 32767, true));
  return URL.createObjectURL(new Blob([bytes], { type: "audio/wav" }));
}

/** Browser-only local data source, used exclusively by /preview. No server requests. */
export async function previewRequest(path: string, init?: RequestInit): Promise<unknown> {
  restore();
  if (init?.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const url = new URL(path, "http://preview.local");
  const route = url.pathname;
  const method = init?.method ?? "GET";
  const body = typeof init?.body === "string" ? JSON.parse(init.body) : {};
  const ids = route.match(/\d+/g)?.map(Number).slice(1) ?? [];
  let result: unknown;
  if (/^\/api\/v1\/shorts(\/popular|\/mine)?$/.test(route)) {
    for (const short of shorts) if (short.shortId <= 3 && short.projectId !== null && !short.mediaUrl) short.mediaUrl = renderAudio(project(short.projectId));
    result = { items: shorts, page: { ...page, size: shorts.length } };
  }
  else if (/\/shorts\/\d+\/composition$/.test(route)) result = { projectId: shorts.find(s => s.shortId === ids[0])?.projectId ?? ids[0] };
  else if (/\/projects\/drafts$/.test(route)) { const id = ++sequence; projects.set(id, newProject(id)); result = { projectId: id }; }
  else if (/\/projects\/\d+\/tracks$/.test(route)) {
    const value = project(ids[0]);
    if (method === "GET") result = value;
    else { const trackId = ++sequence; value.tracks.push({ trackId, ownerId: 1, name: body.name, instrument: body.instrument, volume: 70, isMuted: false, isSolo: false, approvalStatus: "DRAFT", clips: [] }); result = { trackId }; }
  } else if (/\/projects\/\d+\/tracks\/\d+\/clips\/(midi|audio)$/.test(route)) {
    const value = project(ids[0]); const track = value.tracks.find(t => t.trackId === ids[1]);
    if (!track) throw new Error("레이어를 찾을 수 없습니다.");
    const clipId = ++sequence;
    track.clips.push({ ...body, clipId, ownerId: 1, clipType: route.endsWith("midi") ? "MIDI" : "AUDIO", sourceType: "MIDI_INPUT", mediaFileId: body.mediaFileId ?? null, mediaUrl: media.get(body.mediaFileId) ?? null, startTimeMs: body.startTick / value.project.ppq * 60000 / value.project.bpm, durationMs: body.durationTick / value.project.ppq * 60000 / value.project.bpm, clipOffsetMs: 0, approvalStatus: "DRAFT", midiNotes: body.midiNotes ?? [] } as ClipDto);
    result = { clipId };
  } else if (/\/clips\/\d+\/midi$/.test(route)) {
    const clip = [...projects.values()].flatMap(p => p.tracks.flatMap(t => t.clips)).find(c => c.clipId === ids[0]);
    if (!clip) throw new Error("클립을 찾을 수 없습니다."); Object.assign(clip, body); result = {};
  } else if (/\/projects\/\d+\/metadata$/.test(route)) { Object.assign(project(ids[0]).project, body); result = {}; }
  else if (/\/projects\/\d+\/exports$/.test(route)) {
    const value = project(ids[0]); const shortId = ++sequence;
    shorts.unshift({ ...shorts[0], shortId, projectId: ids[0], title: value.project.title, likeCount: 0, dislikeCount: 0, commentCount: 0, viewCount: 0, participants: [{ userId: 1, nickname: profile.nickname, role: "CREATOR" }], albumImageUrl: media.get(value.project.albumImageFileId ?? -1) ?? null, mediaUrl: renderAudio(value), author: { userId: 1, nickname: profile.nickname, profileImageUrl: profile.profileImageUrl } }); result = { exportId: shortId };
  } else if (/\/projects\/\d+\/exports\/\d+$/.test(route)) result = { status: "COMPLETED", shortId: ids[1], errorMessage: null };
  else if (/\/projects\/\d+\/contributions/.test(route)) result = { items: [] };
  else if (/\/notifications\/contributions$/.test(route)) result = { items: [] };
  else if (/\/users\/profiles\/\d+$/.test(route)) { const userId = ids[ids.length - 1]; result = userId === profile.userId ? profile : { ...profile, userId, nickname: userId === author.userId ? author.nickname : "Muhehehe", primaryInstrument: userId === author.userId ? "Guitar" : "Piano", explanation: "음악을 함께 만들어요.", relations: { followerCount: 116, followingCount: 24, isFollowing: false }, activities: { ...profile.activities, posts: posts.filter(p => p.writer.userId === userId).map(p => ({postId:p.postId,title:p.title,thumbnailUrl:p.imageUrl})), postCount: posts.filter(p => p.writer.userId === userId).length } }; }
  else if (/\/users\/me\/profile$/.test(route)) { Object.assign(profile, body); result = profile; }
  else if (/\/users\/me\/profile\/image$/.test(route) && init?.body instanceof FormData) { const file = init.body.get("image"); if (file instanceof Blob) profile.profileImageUrl = URL.createObjectURL(file); result = { profileImageUrl: profile.profileImageUrl }; }
  else if (/\/galleries(\/subscribed)?$/.test(route)) result = galleries.filter(gallery => !route.endsWith("subscribed") || subscribed.has(gallery.galleryId));
  else if (/\/galleries\/\d+\/subscriptions$/.test(route)) { if (method === "DELETE") subscribed.delete(ids[0]); else subscribed.add(ids[0]); result = { galleryId: ids[0] }; }
  else if (/\/galleries\/\d+\/posts$/.test(route)) {
    if (method === "GET") { const keyword=(url.searchParams.get("keyword")??"").toLocaleLowerCase(); const filtered = posts.filter(p => p.gallery.galleryId===ids[0] && `${p.title} ${p.content}`.toLocaleLowerCase().includes(keyword)); const pageIndex=Number(url.searchParams.get("page")??0),size=Number(url.searchParams.get("size")??20); result = { galleryId: ids[0], galleryName: "Muhehehe", currentSort: url.searchParams.get("sort"), searchedKeyword: url.searchParams.get("keyword"), totalCount: filtered.length, posts: filtered.slice(pageIndex*size,(pageIndex+1)*size) }; }
    else { const postId = ++sequence; posts.unshift({ ...posts[0], ...body, gallery:{galleryId:ids[0],name:galleries.find(gallery=>gallery.galleryId===ids[0])?.name??"커뮤니티"}, postId, commentCount:0, likeCount:0, dislikeCount:0, viewCount:0, createdAt:new Date().toISOString(), writer: { ...author, userId: 1, nickname: profile.nickname }, imageUrl: media.get(body.imageFileId) ?? null }); result = { postId }; }
  } else if (/\/posts\/\d+$/.test(route)) { const post = posts.find(p => p.postId === ids[0]); if (!post) throw new Error("게시물을 찾을 수 없습니다."); if (method === "PUT") Object.assign(post, body); if (method === "DELETE") posts.splice(posts.indexOf(post), 1); result = post; }
  else if (/\/posts\/\d+\/views$/.test(route)) result = { contentId: ids[0], counted: false };
  else if (/\/posts\/\d+\/comments$/.test(route)) {
    const postId = ids[0];
    const parentCommentId = url.searchParams.has("parentCommentId") ? Number(url.searchParams.get("parentCommentId")) : null;
    if (method === "GET") {
      const filtered = comments.filter(comment => comment.postId === postId && comment.parentCommentId === parentCommentId);
      const currentPage = Number(url.searchParams.get("page") ?? 0);
      result = { postId, parentCommentId, page: currentPage, size: 20, totalCount: filtered.length, comments: filtered.slice(currentPage * 20, (currentPage + 1) * 20) };
    } else {
      if (body.parentCommentId != null && !comments.some(comment => comment.postId === postId && comment.commentId === body.parentCommentId)) throw new Error("답글의 원본 댓글을 찾을 수 없습니다.");
      const commentId = ++sequence;
      comments.push({ postId, commentId, parentCommentId: body.parentCommentId ?? null, writer: { ...author, userId: 1, nickname: profile.nickname }, content: body.content, replyCount: 0, createdAt: new Date().toISOString() });
      const parent = comments.find(comment => comment.postId === postId && comment.commentId === body.parentCommentId);
      if (parent) parent.replyCount++;
      const post = posts.find(post => post.postId === postId);
      if (post) post.commentCount++;
      result = { commentId };
    }
  } else if (/\/posts\/comments\/\d+$/.test(route)) {
    const comment = comments.find(comment => comment.commentId === ids[0]);
    if (!comment || comment.writer.userId !== 1) throw new Error("본인이 작성한 댓글만 수정·삭제할 수 있습니다.");
    if (method === "PATCH" || method === "PUT") { comment.content = body.content; result = { commentId: comment.commentId }; }
    else if (method === "DELETE") {
      const removed = comments.filter(entry => entry.commentId === comment.commentId || entry.parentCommentId === comment.commentId);
      for (const entry of removed) comments.splice(comments.indexOf(entry), 1);
      const parent = comments.find(entry => entry.commentId === comment.parentCommentId);
      if (parent) parent.replyCount = Math.max(0, parent.replyCount - 1);
      const post = posts.find(post => post.postId === comment.postId);
      if (post) post.commentCount = Math.max(0, post.commentCount - removed.length);
      result = {};
    }
  } else if (/\/media\/upload-sessions$/.test(route)) { const mediaFileId = ++sequence; result = { mediaFileId, uploadUrl: `/preview-media/${mediaFileId}`, method: "PUT" }; }
  else if (route.startsWith("/preview-media/") && init?.body instanceof Blob) { media.set(Number(route.split("/").pop()), URL.createObjectURL(init.body)); return undefined; }
  else if (/\/media\/\d+\/complete$/.test(route)) result = {};
  else throw new Error("이 기능은 실제 서버 연결 후 사용할 수 있습니다.");
  persist();
  return structuredClone(envelope(result));
}

export function setPreviewTempo(projectId: number, bpm: number): CompositionDto {
  const value = project(projectId);
  value.project.bpm = bpm;
  value.project.maxTick = Math.ceil(value.project.maxDurationMs * bpm * value.project.ppq / 60000);
  persist();
  return { ...value, project: { ...value.project } };
}

export function movePreviewClip(projectId:number,clipId:number,startTick:number):CompositionDto {
 const value=project(projectId);
 const track=value.tracks.find(track=>track.clips.some(clip=>clip.clipId===clipId));
 const clip=track?.clips.find(clip=>clip.clipId===clipId);
 if(!track||!clip||!canMoveClip(value.viewerPermission,clip))throw new Error("이 클립을 이동할 권한이 없습니다.");
 if(!Number.isFinite(startTick)||startTick<0||startTick+clip.durationTick>value.project.maxTick||overlapsClip(clip,startTick,track.clips))throw new Error("클립 위치를 확인해주세요.");
 clip.startTick=startTick;clip.startTimeMs=startTick/value.project.ppq*60000/value.project.bpm;
 persist();return structuredClone(value);
}
