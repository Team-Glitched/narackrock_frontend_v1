import { useEffect, useRef, useState } from "react";
import { Asset, Avatar } from "@/components/app/shared";
import { MiniPost } from "./mobile-screens";
import { CommunityCard, galleryToCommunity, type Community } from "./community-card";
import { fetchGalleries, fetchPosts } from "@/lib/api/community";
import { getShorts } from "@/lib/api/shorts";
import type { GalleryListItem, PostListItem, PostWriter, ShortItemDto } from "@/lib/api/contracts";
import type { SearchScope } from "@/features/navigation/context-actions";
import { sourceSnapshot, type PreviewSource } from "@/features/preview/source-store";
import { searchCommunityPosts } from "@/features/community/post-search";
import { isPreviewMode } from "@/features/preview/preview-mode";
const scopes:{id:SearchScope;label:string}[]=[{id:"sources",label:"오픈소스"},{id:"songs",label:"음악"},{id:"people",label:"사용자"},{id:"posts",label:"게시글"},{id:"communities",label:"커뮤니티"}];
type Results={posts:PostListItem[];communities:GalleryListItem[];songs:ShortItemDto[];people:PostWriter[];sources:PreviewSource[]};
const empty=():Results=>({posts:[],communities:[],songs:[],people:[],sources:[]});
export function ScopedSearch({scope:requestedScope,community,onScope,query,onQuery,onBack,onPost,onCommunity,onSong,onProfile,onSource}:{community?:Pick<Community,"galleryId"|"name">|null;scope:SearchScope;onScope:(scope:SearchScope)=>void;query:string;onQuery:(value:string)=>void;onBack:()=>void;onPost:(id:number)=>void;onCommunity:(community:Community)=>void;onSong:(id:number)=>void;onProfile:(id:number)=>void;onSource:(id:number)=>void}) {
  const [retry,setRetry]=useState(0);
  const scope=community?"posts":requestedScope;
  const inputRef=useRef<HTMLInputElement>(null);
  const galleryId=community?.galleryId;
  const key=`${galleryId??"all"}:${scope}:${query.trim()}:${retry}`;
  const [loaded,setLoaded]=useState<{key:string;results:Results;error?:string}|null>(null);
  useEffect(()=>{
    const keyword=query.trim();if(!keyword)return;
    let active=true;
    const timer=window.setTimeout(()=>{void (async()=>{
      const results=empty();const matches=(value:string)=>value.toLocaleLowerCase().includes(keyword.toLocaleLowerCase());
      if(galleryId!==undefined)results.posts=await searchCommunityPosts(fetchPosts,galleryId,keyword);
      else if(scope==="communities")results.communities=(await fetchGalleries()).filter(item=>matches(`${item.name} ${item.description??""}`));
      else if(scope==="songs")results.songs=(await getShorts()).items.filter(item=>matches(`${item.title} ${item.author.nickname}`));
      else if(scope==="posts"||scope==="people"){
        const galleries=await fetchGalleries();
        const pages=await Promise.all(galleries.map(async gallery=>scope==="posts"?searchCommunityPosts(fetchPosts,gallery.galleryId,keyword):(await fetchPosts(gallery.galleryId,{size:100})).posts));
        const posts=[...new Map(pages.flat().map(post=>[post.postId,post])).values()];
        if(scope==="posts")results.posts=posts;
        else {results.people=[...new Map(posts.map(post=>[post.writer.userId,post.writer])).values()].filter(person=>matches(person.nickname));if(isPreviewMode()&&matches("Muhehehe"))results.people.push({userId:3,nickname:"Muhehehe",profileImageUrl:"/figma/profile.png"});}
      } else if(isPreviewMode())results.sources=sourceSnapshot().filter(source=>matches(`${source.title} ${source.description}`));
      if(active)setLoaded({key,results});
    })().catch(cause=>{if(active)setLoaded({key,results:empty(),error:cause instanceof Error?cause.message:"검색에 실패했습니다."});});},200);
    return()=>{active=false;window.clearTimeout(timer);};
  },[scope,query,key,galleryId]);
  const results=loaded?.key===key?loaded.results:null;
  return <div className="search-view scoped-search"><div className="search-line"><button onClick={onBack} aria-label="돌아가기" title="돌아가기"><Asset name="search-back.svg"/></button><label><Asset name="search-input.svg"/><input ref={inputRef} autoFocus aria-label={community?`${community.name} 내부 게시글 검색`:`${scopes.find(item=>item.id===scope)?.label} 검색`} value={query} onChange={event=>onQuery(event.target.value)} placeholder={community?"커뮤니티 내 게시글 검색":"검색"}/><button onClick={()=>{onQuery("");inputRef.current?.focus();}} aria-label="검색어 지우기"><Asset name="search-close.svg"/></button></label></div>
    {community&&<p className="community-search-context">{community.name} 내 게시글</p>}
    {!community&&query.trim() && <div className="search-scope-tabs" role="tablist" aria-label="검색 종류">{scopes.map(item=><button role="tab" key={item.id} aria-selected={scope===item.id} className={scope===item.id?"active":""} onClick={()=>onScope(item.id)}>{item.label}</button>)}</div>}
    <div className="scoped-search-results scroll-content" role="tabpanel" aria-label={community?`${community.name} 내부 검색 결과`:`${scopes.find(item=>item.id===scope)?.label} 검색 결과`}>
      {query.trim()&&!results&&<p role="status">검색 중...</p>}
      {loaded?.key===key&&loaded.error&&<div role="alert"><p>{loaded.error}</p><button className="gray-pill compact" onClick={()=>setRetry(value=>value+1)}>다시 시도</button></div>}
      {results&&Object.values(results).every(items=>items.length===0)&&!loaded?.error&&<p className="search-result">검색 결과가 없습니다.</p>}
      {scope==="posts"&&results?.posts.map(post=><MiniPost key={post.postId} post={post} onOpen={onPost}/>)}
      {scope==="communities"&&<ul className="community-card-list">{results?.communities.map(gallery=><CommunityCard key={gallery.galleryId} community={galleryToCommunity(gallery)} onOpen={onCommunity}/>)}</ul>}
      {scope==="songs"&&results?.songs.map(song=><button className="chart-row" key={song.shortId} onClick={()=>onSong(song.shortId)}><span className="chart-art">{song.albumImageUrl?<AssetImage url={song.albumImageUrl}/>:<span className="empty-artwork"/>}</span><span><strong>{song.title}</strong><small>{song.author.nickname}</small></span></button>)}
      {scope==="people"&&results?.people.map(person=><button className="person-link search-person" key={person.userId} onClick={()=>onProfile(person.userId)}><Avatar src={person.profileImageUrl}/><strong>{person.nickname}</strong></button>)}
      {scope==="sources"&&results?.sources.map(source=><button className="os-card" key={source.id} onClick={()=>onSource(source.id)}><strong>{source.title}</strong><small>{source.author}</small></button>)}
    </div>
  </div>;
}
function AssetImage({url}:{url:string}){
  return <img src={url} alt="앨범 커버"/>;
}
