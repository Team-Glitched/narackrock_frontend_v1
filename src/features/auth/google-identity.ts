export type GoogleProfileHints = { name: string | null; picture: string | null };
export type GoogleCredentialResponse = { credential: string };

type GoogleAccounts = {
  id: {
    initialize(options: {
      client_id: string;
      callback: (response: GoogleCredentialResponse) => void;
    }): void;
    renderButton(element: HTMLElement, options: Record<string, string | number | boolean>): void;
  };
};

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

let scriptPromise: Promise<GoogleAccounts> | null = null;

export function loadGoogleAccounts(): Promise<GoogleAccounts> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("브라우저에서만 Google 로그인을 사용할 수 있습니다."));
  if (window.google?.accounts) return Promise.resolve(window.google.accounts);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-google-identity="true"]',
    );
    const script = existing ?? document.createElement("script");
    const finish = () =>
      window.google?.accounts
        ? resolve(window.google.accounts)
        : reject(new Error("Google 로그인 모듈을 불러오지 못했습니다."));
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("Google 로그인 모듈을 불러오지 못했습니다.")),
      { once: true },
    );
    if (!existing) {
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.dataset.googleIdentity = "true";
      document.head.appendChild(script);
    }
  });
  return scriptPromise;
}

export function decodeGoogleCredential(credential: string): GoogleProfileHints {
  try {
    const encoded = credential.split(".")[1];
    if (!encoded) return { name: null, picture: null };
    const normalized = encoded
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encoded.length / 4) * 4, "=");
    const bytes = Uint8Array.from(atob(normalized), (character) => character.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as {
      name?: unknown;
      picture?: unknown;
    };
    return {
      name: typeof payload.name === "string" ? payload.name : null,
      picture: typeof payload.picture === "string" ? payload.picture : null,
    };
  } catch {
    return { name: null, picture: null };
  }
}
