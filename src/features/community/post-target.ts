type GalleryState = {status:"loading"|"error"}|{status:"ready";galleries:readonly {galleryId:number}[]};
export type PostTargetStatus = "loading"|"error"|"missing"|"ready";
export function resolvePostTarget(galleries:GalleryState,galleryId:number):PostTargetStatus {
  if(galleries.status!=="ready")return galleries.status;
  return galleries.galleries.some(gallery=>gallery.galleryId===galleryId)?"ready":"missing";
}
