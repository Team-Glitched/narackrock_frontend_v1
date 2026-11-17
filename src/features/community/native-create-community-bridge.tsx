import { useLoginPrompt } from "@/features/auth/login-prompt";
import type { SocialCreateState } from "@/features/community/create-content";
import { useMyGalleryProposals } from "@/features/community/my-gallery-proposals";
import { useNativeScreen } from "@/features/navigation/use-native-screen";
import type { NativeCreateCommunity } from "@/lib/native-screens";

export const createCommunitySignInMessage = "커뮤니티 개설 신청은 로그인 후 사용할 수 있습니다.";

/**
 * In the app /communities/new (MyGalleryProposals and the community SocialCreate form) is drawn natively.
 * `form` is the page's own form state (null when signed out); the web keeps the draft and submits it, and
 * its "작성 취소" confirmation is mounted as a native dialog by SocialCreateForm.
 */
export function NativeCreateCommunityBridge({
  form,
  submitted,
  formKey,
  onBack,
  onSearch,
}: {
  form: SocialCreateState | null;
  submitted: boolean;
  formKey: number;
  onBack: () => void;
  onSearch: () => void;
}) {
  const { requestLogin } = useLoginPrompt();
  const proposals = useMyGalleryProposals();
  const model: NativeCreateCommunity = form
    ? {
        signedIn: true,
        proposals: proposals && {
          submitted,
          failed: proposals.failed,
          items: proposals.lines.map((line) => line.text),
        },
        blocked: form.restoring
          ? "작성 중인 내용을 불러오는 중..."
          : form.draftExpired && !form.busy
            ? "다른 탭에서 이 초안을 등록하거나 삭제했습니다. 작성 화면을 다시 열어주세요."
            : null,
        title: form.title,
        content: form.content,
        busy: form.busy,
        draftStatus: form.draftStatus,
        errors: [
          form.error,
          form.storageError,
          form.imageRestoreFailed
            ? "앨범 이미지를 복원하지 못했습니다. 다시 첨부하거나 이미지 없이 등록을 선택해주세요."
            : form.restoreError,
        ].filter((message): message is string => Boolean(message)),
        keepWithoutImage: form.imageRestoreFailed,
        canSubmit: form.canSubmit,
        submitLabel: form.submitLabel,
        formKey,
      }
    : { signedIn: false, message: createCommunitySignInMessage };
  return useNativeScreen("social-create-community", model, {
    header: { left: "back", actions: ["notifications", "search", "account"] },
    onBack,
    onSearch,
    onAction: (action) => {
      switch (action.type) {
        case "sign-in":
          return requestLogin();
        case "title":
          return form?.setTitle(action.value);
        case "content":
          return form?.setContent(action.value);
        case "submit":
          if (form?.canSubmit) void form.submit();
          return;
        case "discard":
          return form?.setConfirmDiscard(true);
        case "keep-without-image":
          return form?.keepWithoutImage();
      }
    },
  });
}
