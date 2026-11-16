import { useState } from "react";
import { Asset } from "@/components/asset";
import { profileErrorMessage } from "@/features/profile/profile-screens";
import { ApiError } from "@/lib/api/client";
import { updateProfile } from "@/lib/api/profile";
import { profileStyles } from "@/styles/profile.styles";

const setupFields = ["nickname", "instrument", "explanation"] as const;

export type ProfileSetupStep = 0 | 1 | 2;
export type ProfileSetupValues = Record<(typeof setupFields)[number], string>;

/**
 * The first-login profile setup: one field per step (name, main instrument, description), each
 * required, then the profile is saved. Shared by the web screen and the app's native onboarding.
 */
export function useInitialProfileSetup(suggestedNickname: string, onSaved: () => void) {
  const [step, setStep] = useState<ProfileSetupStep>(0);
  const [values, setValues] = useState<ProfileSetupValues>({
    nickname: suggestedNickname,
    instrument: "",
    explanation: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const field = setupFields[step];

  function change(value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  /** Validates the current step's field (`value`, default: the typed one), then moves on or saves. */
  async function advance(value = values[field]) {
    const next = { ...values, [field]: value };
    setValues(next);
    setError(null);

    if (step === 0) {
      if (!next.nickname.trim()) {
        setError("이름을 입력해 주세요.");
        return;
      }

      setStep(1);
      return;
    }

    if (step === 1) {
      if (!next.instrument.trim()) {
        setError("주 악기를 입력해 주세요.");
        return;
      }

      setStep(2);
      return;
    }

    if (!next.explanation.trim()) {
      setError("설명을 입력해 주세요.");
      return;
    }

    setSaving(true);

    try {
      await updateProfile({
        nickname: next.nickname.trim(),
        primaryInstrument: next.instrument.trim(),
        explanation: next.explanation.trim(),
      });

      onSaved();
    } catch (cause) {
      if (cause instanceof ApiError && cause.errorCode === "DUPLICATE_NICKNAME") {
        setStep(0);
      }

      setError(profileErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return { step, values, field, saving, error, change, advance };
}

export function InitialProfileSetupScreen({
  suggestedNickname,
  onSaved,
}: {
  suggestedNickname: string;
  pictureUrl: string | null;
  onSaved: () => void;
}) {
  const { step, values, saving, error, change, advance } = useInitialProfileSetup(
    suggestedNickname,
    onSaved,
  );

  return (
    <form
      className={profileStyles.profileOnboarding}
      onSubmit={(event) => {
        event.preventDefault();
        void advance();
      }}
    >
      <header className={profileStyles.authHeader}>
        <Asset name="auth-logo.svg" alt="Narackrock" />
      </header>

      <div className={profileStyles.profileOnboardingContent} key={step}>
        {step === 0 && (
          <>
            <h1>당신의 이름은 무엇인가요?</h1>
            <p>이름을 알려주세요</p>
            <label>
              이름
              <input
                value={values.nickname}
                onChange={(event) => change(event.target.value)}
                maxLength={30}
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {step === 1 && (
          <>
            <h1>당신의 주 악기는 무엇인가요?</h1>
            <p>악기를 알려주세요</p>
            <label>
              악기
              <input
                value={values.instrument}
                onChange={(event) => change(event.target.value)}
                placeholder="피아노, 기타"
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {step === 2 && (
          <>
            <h1>당신을 설명해주세요</h1>
            <p>당신은 어떤 사람인가요?</p>
            <label>
              설명
              <input
                value={values.explanation}
                onChange={(event) => change(event.target.value)}
                autoFocus
                disabled={saving}
              />
            </label>
          </>
        )}

        {error && (
          <p className={profileStyles.profileFormError} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={profileStyles.profileOnboardingNext} disabled={saving}>
          {saving ? "저장 중..." : step === 2 ? "시작하기" : "다음"}
        </button>
      </div>
    </form>
  );
}
