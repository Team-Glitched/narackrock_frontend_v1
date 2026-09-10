"use client";
import { useEffect } from "react";
import type { Navigate, View } from "@/features/navigation/types";
import { views } from "@/features/navigation/types";
type WebMcpContext = { registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown };
export function useWebMcpNavigation(go: Navigate) { useEffect(() => { const context = (document as Document & { modelContext?: WebMcpContext }).modelContext; if (!context?.registerTool) return; const controller = new AbortController(); void Promise.resolve(context.registerTool({ name: "navigate_narackrock_view", title: "나락락 화면 열기", description: "나락락 v3의 화면으로 이동합니다.", inputSchema: { type: "object", properties: { view: { type: "string", enum: views } }, required: ["view"], additionalProperties: false }, execute(input: { view?: View }) { if (!input.view || !views.includes(input.view)) throw new Error("지원하지 않는 화면입니다."); go(input.view); return { view: input.view }; } }, { signal: controller.signal })).catch(() => undefined); return () => controller.abort(); }, [go]); }
