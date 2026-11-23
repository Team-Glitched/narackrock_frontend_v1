import { cva, type VariantProps } from "class-variance-authority";
import { sharedStyles } from "./shared.styles.ts";

export const buttonVariants = cva("h-10 shrink-0 rounded-pill px-[17px] py-0 text-label whitespace-nowrap", {
  variants: {
    tone: { primary: sharedStyles.purplePill, secondary: sharedStyles.grayPill },
    size: { default: "", compact: sharedStyles.compact },
  },
  defaultVariants: { tone: "primary", size: "default" },
});

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
  "relative flex h-7 min-w-0 flex-none items-center justify-center gap-1.5 border-0 text-body leading-[20px] after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] disabled:cursor-not-allowed disabled:opacity-100",
  {
    variants: {
      kind: {
        default: "rounded-panel bg-app-surface px-2.5 py-0.5",
        vote: "w-auto rounded-none bg-transparent p-0",
        icon: "size-8 rounded-panel bg-app-surface p-0",
      },
    },
    defaultVariants: { kind: "default" },
  },
);

export const filterChipVariants = cva(
  "relative flex-none rounded-full border border-solid font-sans text-caption font-medium whitespace-nowrap focus-visible:outline-2",
  {
    variants: {
      appearance: {
        outline:
          "border-app-border bg-transparent text-app-muted aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-app-fg after:absolute after:inset-x-0 after:-inset-y-[9px] after:content-[''] focus-visible:outline-offset-4 focus-visible:outline-app-primary-soft",
        filled:
          "border-app-border bg-transparent text-app-muted aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-app-fg focus-visible:outline-offset-2 focus-visible:outline-app-accent",
      },
      size: {
        compact: "min-h-[26px] px-3 py-0.5 leading-4",
        standard: "min-h-7 px-3 py-1 leading-[18px]",
      },
    },
    defaultVariants: { appearance: "outline", size: "compact" },
  },
);

export const filterChipRow = "scrollbar-none flex min-w-0 items-center gap-2 overflow-x-auto py-1";
export const filterChip =
  "relative min-h-7 shrink-0 rounded-full border border-solid border-app-border bg-transparent px-3 py-1 text-caption leading-[18px] font-medium whitespace-nowrap text-app-muted aria-pressed:border-app-primary aria-pressed:bg-app-primary aria-pressed:text-app-fg focus-visible:outline-2 focus-visible:outline-app-accent disabled:opacity-50";

export const preferenceRow =
  "flex min-h-16 w-full cursor-pointer items-center justify-between gap-4 py-3 text-left text-app-fg";
export const preferenceCopy =
  "flex min-w-0 flex-1 flex-col gap-1.5 [&>strong]:text-label [&>strong]:leading-6 [&>strong]:font-medium [&>strong]:[overflow-wrap:anywhere] [&>small]:text-body [&>small]:leading-5 [&>small]:font-normal [&>small]:text-app-muted";
export const preferenceSwitch =
  "relative h-6 w-11 shrink-0 cursor-pointer appearance-none rounded-full bg-app-line transition-colors checked:bg-app-primary motion-reduce:transition-none before:absolute before:top-1 before:left-1 before:size-4 before:rounded-full before:bg-app-fg before:transition-transform before:content-[''] checked:before:translate-x-5 motion-reduce:before:transition-none disabled:opacity-50";

export const badgeVariants = cva(
  "inline-flex w-fit self-start min-h-6 items-center rounded-full border border-solid px-3 py-0.5 font-sans text-caption leading-4 font-semibold whitespace-nowrap",
  {
    variants: {
      status: {
        request: "border-[#5b00ff] bg-[#5b00ff] text-white",
        approved: "border-[#16a34a] bg-[#16a34a] text-white",
        rejected: "border-[#e11d48] bg-[#e11d48] text-white",
        resource: "border-[#7c3aed] bg-[#7c3aed] text-white",
        pending: "border-[#d97706] bg-[#d97706] text-white",
      },
    },
    defaultVariants: { status: "pending" },
  },
);

export type ButtonVariantProps = VariantProps<typeof buttonVariants>;
export type BadgeStatus = NonNullable<VariantProps<typeof badgeVariants>["status"]>;
