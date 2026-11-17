import { Link } from "react-router";
import { nativeApp } from "@/lib/native-app";
import { NativePageStateBridge } from "@/features/community/native-community-bridge";
import { useUrlNavigation } from "@/features/navigation/use-url-navigation";
export default function NotFoundPage() {
  const { to } = useUrlNavigation();
  if (nativeApp())
    return (
      <NativePageStateBridge
        state={{
          message: "페이지를 찾을 수 없습니다.",
          tone: "error",
          createLabel: "홈으로 돌아가기",
        }}
        onBack={() => to("/")}
        onSearch={() => to("/search")}
        onCreate={() => to("/")}
      />
    );
  return (
    <main className="grid min-h-svh place-content-center gap-4 p-5 text-center">
      <h1>페이지를 찾을 수 없습니다.</h1>
      <Link to="/">홈으로 돌아가기</Link>
    </main>
  );
}
