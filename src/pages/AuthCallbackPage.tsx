import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type Status = "loading" | "success" | "error";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let cancelled = false;

    const handleCallback = async () => {
      try {
        // ── PKCE flow: Supabase appends ?code= to the redirect URL ──────────
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;

          if (!cancelled) {
            setStatus("success");
            setTimeout(() => navigate("/", { replace: true }), 800);
          }
          return;
        }

        // ── Implicit flow: Supabase appends #access_token=… to the URL ──────
        // onAuthStateChange picks this up automatically; we just wait for it.
        const hash = window.location.hash;
        if (hash && hash.includes("access_token")) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (data.session) {
            if (!cancelled) {
              setStatus("success");
              setTimeout(() => navigate("/", { replace: true }), 800);
            }
            return;
          }

          // Session not hydrated yet — wait for onAuthStateChange
          const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
              if (cancelled) return;
              if (session) {
                setStatus("success");
                setTimeout(() => navigate("/", { replace: true }), 800);
              } else if (event === "SIGNED_OUT" || !session) {
                setErrorMessage("We couldn't verify your session. Please try signing in again.");
                setStatus("error");
              }
              subscription.unsubscribe();
            }
          );
          return;
        }

        // ── No recognised params — likely a stale or invalid link ────────────
        throw new Error("No authentication parameters found in this link. It may have expired.");
      } catch (err: unknown) {
        if (!cancelled) {
          setErrorMessage(
            err instanceof Error
              ? err.message
              : "An unexpected error occurred. Please try again."
          );
          setStatus("error");
        }
      }
    };

    handleCallback();
    return () => { cancelled = true; };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {status === "loading" && <LoadingState />}
        {status === "success" && <SuccessState />}
        {status === "error" && (
          <ErrorState
            message={errorMessage}
            onBack={() => navigate("/login", { replace: true })}
          />
        )}
      </div>
    </div>
  );
}

/* ─── States ───────────────────────────────────────────────────────────── */

function LoadingState() {
  return (
    <>
      <Spinner />
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Confirming your account…</h1>
        <p className="text-sm text-muted-foreground">
          Please wait while we verify your session.
        </p>
      </div>
    </>
  );
}

function SuccessState() {
  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
        <CheckIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">You&apos;re all set!</h1>
        <p className="text-sm text-muted-foreground">Redirecting you now…</p>
      </div>
    </>
  );
}

function ErrorState({ message, onBack }: { message: string; onBack: () => void }) {
  return (
    <>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
        <XIcon className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground">Confirmation failed</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
      <button
        onClick={onBack}
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        Back to login
      </button>
    </>
  );
}

/* ─── Icons ────────────────────────────────────────────────────────────── */

function Spinner() {
  return (
    <div className="mx-auto h-12 w-12">
      <svg
        className="animate-spin text-primary"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}