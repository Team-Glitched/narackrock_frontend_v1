const assetRoot = "/figma/";
export function Asset({
  name,
  alt = "",
  className = "",
}: {
  name: string;
  alt?: string;
  className?: string;
}) {
  // Local Figma exports keep their explicit layout dimensions.
  return <img src={`${assetRoot}${name}`} alt={alt} className={className} draggable={false} />;
}
