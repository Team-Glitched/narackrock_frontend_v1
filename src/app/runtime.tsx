import { Outlet } from "react-router";
import { useWebMcpNavigation } from "@/hooks/use-webmcp-navigation";

export function AppRuntime() {
  useWebMcpNavigation();
  return <Outlet />;
}
