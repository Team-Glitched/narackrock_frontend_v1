import { iconSlotVariants } from "@/styles/variants";
import { Asset } from "./asset";
/** Figma layout slots exclude the SVG's painted stroke overflow. */
export function IconSlot({
  name,
  kind,
}: {
  name: string;
  kind: "mini" | "post" | "short" | "post-save" | "short-save" | "short-share" | "nav";
}) {
  return (
    <span className={iconSlotVariants({ kind })} aria-hidden="true">
      <Asset name={name} />
    </span>
  );
}
