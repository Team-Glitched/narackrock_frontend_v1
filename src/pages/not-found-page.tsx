import { Link } from "react-router";
export default function NotFoundPage() {
  return <main className="grid min-h-svh place-content-center gap-4 p-5 text-center"><h1>페이지를 찾을 수 없습니다.</h1><Link to="/">홈으로 돌아가기</Link></main>;
}
