import { useEffect } from "react";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
import { safeReturnPath } from "@/features/navigation/paths";
type WebMcpContext = {
  registerTool?: (tool: unknown, options?: { signal?: AbortSignal }) => unknown;
};
export function useWebMcpNavigation() {
  const { to } = useUrlNavigation();
  useEffect(() => {
    const context = (document as Document & { modelContext?: WebMcpContext }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "navigate_narackrock_path",
          title: "나락락 화면 열기",
          description: "나락락의 로컬 URL 경로로 이동합니다.",
          inputSchema: {
            type: "object",
            properties: { path: { type: "string" } },
            required: ["path"],
            additionalProperties: false,
          },
          execute(input: { path?: string }) {
            const normalizedPath = safeReturnPath(input.path, "");
            if (!normalizedPath) throw new Error("지원하지 않는 경로입니다.");
            to(normalizedPath);
            return { path: normalizedPath };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => undefined);
    return () => controller.abort();
  }, [to]);
}
