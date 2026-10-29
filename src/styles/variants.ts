import { cva, type VariantProps } from "class-variance-authority";
import { sharedStyles } from "./shared.styles.ts";

export const buttonVariants = cva(
  "h-10 rounded-pill px-[17px] py-0 text-label whitespace-nowrap",
  {
    variants: {
      tone: { primary: sharedStyles.purplePill, secondary: sharedStyles.grayPill },
      size: { default: "", compact: sharedStyles.compact },
    },
    defaultVariants: { tone: "primary", size: "default" },
  },
);

export const iconSlotVariants = cva(sharedStyles.figmaIconSlot, {
  variants: {
    kind: {
      mini: sharedStyles.figmaIconSlotMini,
      post: sharedStyles.figmaIconSlotPost,
      short: sharedStyles.figmaIconSlotShort,
      "post-save": sharedStyles.figmaIconSlotPostSave,
      "short-save": sharedStyles.figmaIconSlotShortSave,
      "short-share": sharedStyles.figmaIconSlotShortShare,
      nav: sharedStyles.figmaIconSlotNav,
    },
  },
});

export const reactionControlVariants = cva(
  "relative flex h-[26px] min-w-0 flex-none items-center justify-center gap-2 border-0 after:absolute after:inset-x-0 after:-inset-y-[5px] after:content-[''] disabled:cursor-not-allowed disabled:opacity-100",
  {
    variants: {
      kind: {
        default: "rounded-panel bg-app-surface px-[10px] py-[3px]",
        vote: "w-auto rounded-none bg-transparent p-0",
        icon: "w-9 rounded-panel bg-app-surface p-0",
      },
    },
    defaultVariants: { kind: "default" },
  },
);

export const filterChipVariants = cva(
  "relative flex-none border border-solid font-sans text-caption font-medium whitespace-nowrap focus-visible:outline-2",
  {
    variants: {
      appearance: {
        outline: "rounded-[15px] border-app-surface aria-pressed:bg-app-surface after:absolute after:inset-x-0 after:-inset-y-[9px] after:content-[''] focus-visible:outline-offset-4 focus-visible:outline-app-primary-soft",
        filled: "rounded-card border-app-border bg-app-surface text-app-muted aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-app-fg focus-visible:outline-offset-2 focus-visible:outline-app-accent",
      },
      size: {
        compact: "min-h-[26px] px-3 py-1 leading-4",
        standard: "min-h-7 px-[10px] py-1 leading-[18px]",
      },
    },
    defaultVariants: { appearance: "outline", size: "compact" },
  },
);

export const badgeVariants = cva(
  "mb-[10px] inline-flex min-h-6 items-center rounded-control border border-solid px-[9px] py-[3px] font-sans text-caption leading-4 font-medium",
  {
    variants: {
      status: {
        request: "border-[#57358a] bg-app-primary-deep text-app-primary-soft",
        approved: "border-[#3c5a4d] bg-[#24342e] text-[#c1e4d3]",
        rejected: "border-[#61414a] bg-[#38292e] text-[#f1c1cb]",
        resource: "border-[#57358a] bg-app-surface text-app-primary-soft",
        pending: "border-app-border bg-app-surface text-app-fg",
      },
    },
    defaultVariants: { status: "pending" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type BadgeStatus = NonNullable<VariantProps<typeof badgeVariants>["status"]>;
