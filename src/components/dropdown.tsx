import { Check, ChevronDown } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type DropdownOption<T> = { value: T; label: string };

type DropdownProps<T extends string | number> = {
  id?: string;
  label: string;
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  compact?: boolean;
  icon?: ReactNode;
  className?: string;
};

const rowHeight = 36;
const maxMenuHeight = 226;
const inset = 8;
const gap = 5;

function getMenuPosition(
  trigger: HTMLElement,
  host: HTMLElement,
  optionCount: number,
): CSSProperties {
  const canvas = trigger.closest<HTMLElement>(".design-canvas");
  const anchor = trigger.getBoundingClientRect();
  const bounds = host.getBoundingClientRect();
  const insideCanvas = Boolean(canvas);
  // The dialog overlay fills the canvas, so both hosts share its logical coordinates.
  const scale = canvas ? bounds.width / host.offsetWidth : 1;
  const availableWidth = canvas ? host.offsetWidth : window.innerWidth;
  const availableHeight = canvas ? host.offsetHeight : window.innerHeight;
  const left = (anchor.left - (canvas ? bounds.left : 0)) / scale;
  const top = (anchor.top - (canvas ? bounds.top : 0)) / scale;
  const anchorWidth = anchor.width / scale;
  const anchorHeight = anchor.height / scale;
  const width = Math.min(Math.max(anchorWidth, 128), availableWidth - 2 * inset);
  const below = availableHeight - (top + anchorHeight + gap) - inset;
  const above = top - gap - inset;
  const desiredHeight = Math.min(maxMenuHeight, optionCount * rowHeight + 10);
  const opensAbove = below < desiredHeight && above > below;
  return {
    position: insideCanvas ? "absolute" : "fixed",
    left: Math.min(Math.max(left, inset), availableWidth - width - inset),
    width,
    maxHeight: Math.max(0, Math.min(desiredHeight, opensAbove ? above : below)),
    ...(opensAbove ? { bottom: availableHeight - top + gap } : { top: top + anchorHeight + gap }),
  };
}

export function Dropdown<T extends string | number>({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
  compact = false,
  icon,
  className,
}: DropdownProps<T>) {
  const listId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ query: "", at: 0 });
  const [menu, setMenu] = useState<{ host: HTMLElement; position: CSSProperties } | null>(null);
  const [active, setActive] = useState(0);
  const selected = options.findIndex((option) => option.value === value);
  const open = Boolean(menu) && !disabled && options.length > 0;
  const activeIndex = Math.min(active, options.length - 1);

  function show(index = Math.max(selected, 0)) {
    const anchor = trigger.current;
    if (!anchor || disabled || !options.length) return;
    const host =
      anchor.closest<HTMLElement>(".canvas-dialog-overlay, .design-canvas") ?? document.body;
    typed.current = { query: "", at: 0 };
    setActive(index);
    setMenu({ host, position: getMenuPosition(anchor, host, options.length) });
  }

  function choose(index: number) {
    const option = options[index];
    setMenu(null);
    if (option && option.value !== value) onChange(option.value);
  }

  useEffect(() => {
    if (!open) return;
    function dismissOutside(event: Event) {
      const target = event.target;
      if (
        !(target instanceof Node) ||
        trigger.current?.contains(target) ||
        list.current?.contains(target)
      )
        return;
      setMenu(null);
    }
    const dismiss = () => setMenu(null);
    document.addEventListener("pointerdown", dismissOutside);
    // An ancestor can scroll the trigger out of view; scrolling the options themselves is safe.
    window.addEventListener("scroll", dismissOutside, true);
    window.addEventListener("resize", dismiss);
    return () => {
      document.removeEventListener("pointerdown", dismissOutside);
      window.removeEventListener("scroll", dismissOutside, true);
      window.removeEventListener("resize", dismiss);
    };
  }, [open]);

  useLayoutEffect(() => {
    const panel = list.current;
    const option = panel?.children[activeIndex];
    if (!panel || !(option instanceof HTMLElement)) return;
    if (option.offsetTop < panel.scrollTop) panel.scrollTop = option.offsetTop;
    const bottom = option.offsetTop + option.offsetHeight;
    if (bottom > panel.scrollTop + panel.clientHeight)
      panel.scrollTop = bottom - panel.clientHeight;
  }, [open, activeIndex]);

  function handleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey) return;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          show(selected >= 0 ? selected : event.key === "ArrowUp" ? options.length - 1 : 0);
        } else {
          const step = event.key === "ArrowDown" ? 1 : -1;
          setActive(Math.max(0, Math.min(activeIndex + step, options.length - 1)));
        }
        return;
      case "Home":
      case "End":
        event.preventDefault();
        if (open) setActive(event.key === "Home" ? 0 : options.length - 1);
        else show(event.key === "Home" ? 0 : options.length - 1);
        return;
      case "Enter":
      case " ":
        event.preventDefault();
        if (event.repeat) return;
        if (open) choose(activeIndex);
        else show();
        return;
      case "Escape":
        if (!open) return;
        event.preventDefault();
        event.stopPropagation();
        setMenu(null);
        return;
      case "Tab":
        if (open) choose(activeIndex);
        return;
    }
    if (event.key.length !== 1) return;
    const now = Date.now();
    const key = event.key.toLocaleLowerCase();
    const previous = typed.current;
    let query = open && now - previous.at < 500 ? previous.query + key : key;
    let index = options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(query));
    if (index < 0 && query !== key) {
      query = key;
      index = options.findIndex((option) => option.label.toLocaleLowerCase().startsWith(query));
    }
    if (index < 0) return;
    event.preventDefault();
    if (open) setActive(index);
    else show(index);
    typed.current = { query, at: now };
  }

  return (
    <>
      <button
        ref={trigger}
        id={id}
        type="button"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${activeIndex}` : undefined}
        disabled={disabled || options.length === 0}
        onClick={(event) => {
          if (open) setMenu(null);
          else {
            event.currentTarget.focus({ preventScroll: true });
            show();
          }
        }}
        onBlur={() => setMenu(null)}
        onKeyDown={handleKey}
        className={cn(
          "inline-flex min-w-0 cursor-pointer items-center justify-between gap-2 rounded-lg border border-app-border bg-app-surface font-medium text-app-fg transition-colors",
          "hover:border-app-muted aria-expanded:border-app-primary focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-app-primary disabled:cursor-default disabled:opacity-50",
          compact ? "h-7 gap-1 px-1.5 text-caption" : "min-h-10 px-3 text-body",
          className,
        )}
      >
        {icon}
        <span className="truncate">{options[selected]?.label}</span>
        <ChevronDown
          size={compact ? 13 : 16}
          className={cn("shrink-0 text-app-muted transition-transform", open && "rotate-180 text-app-fg")}
          aria-hidden="true"
        />
      </button>
      {open &&
        menu &&
        createPortal(
          <ul
            ref={list}
            id={listId}
            role="listbox"
            aria-label={label}
            style={menu.position}
            onMouseDown={(event) => event.preventDefault()}
            className="z-[110] overflow-y-auto overscroll-contain rounded-xl border border-app-border bg-app-panel p-1 shadow-[0_10px_24px_rgba(0,0,0,0.45)]"
          >
            {options.map((option, index) => (
              <li
                key={option.value}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === selected}
                onPointerMove={(event) => {
                  if (event.pointerType === "mouse") setActive(index);
                }}
                onClick={() => choose(index)}
                className={cn(
                  "flex h-9 cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 text-body text-app-fg transition-colors",
                  index === activeIndex && index !== selected && "bg-app-raised",
                  index === selected && "bg-app-primary font-semibold text-white",
                )}
              >
                <span className="truncate">{option.label}</span>
                {index === selected && <Check size={16} className="shrink-0 text-white" aria-hidden="true" />}
              </li>
            ))}
          </ul>,
          menu.host,
        )}
    </>
  );
}
