import { Navigate, useParams } from "react-router";
import { readId } from "@/features/navigation/paths";
import NotFoundPage from "@/features/navigation/pages/not-found-page";

/** Server short share links use `/shorts/:id`; the app's short route is `/abyss/:id`. */
export default function ShortLinkPage() {
  const shortId = readId(useParams().shortId);
  return shortId === null ? <NotFoundPage /> : <Navigate to={`/abyss/${shortId}`} replace />;
}
