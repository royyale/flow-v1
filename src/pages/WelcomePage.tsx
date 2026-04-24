import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import flowLogo from "./flow-logo.svg";

export default function WelcomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (!user) return;

    const check = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("id", user.id)
        .single();
      if ((data as any)?.is_active) {
        setActivated(true);
        setTimeout(() => navigate("/", { replace: true }), 1500);
        return true;
      }
      return false;
    };

    // Run immediately, then poll every 2 s
    check().then((done) => {
      if (done) return;
      const id = setInterval(async () => {
        const done = await check();
        if (done) clearInterval(id);
      }, 2000);
      // Stop polling after 5 minutes regardless
      setTimeout(() => clearInterval(id), 5 * 60 * 1000);
    });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="mx-auto flex justify-center">
          <img src={flowLogo} width={48} height={48} alt="Flow" />
        </div>
        {activated ? (
          <>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckIcon className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">You&apos;re in!</h1>
              <p className="text-sm text-muted-foreground">Taking you to Flow…</p>
            </div>
          </>
        ) : (
          <>
            <Spinner />
            <div className="space-y-1">
              <h1 className="text-xl font-bold text-foreground">Activating your account…</h1>
              <p className="text-sm text-muted-foreground">
                Confirming your subscription. This only takes a moment.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <div className="mx-auto h-12 w-12">
      <svg className="animate-spin text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      className={className}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
