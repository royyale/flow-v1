import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import flowLogo from "./flow-logo.svg";

export default function SubscribePage() {
  const { user, profile, profileLoading } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already active — skip to app
  useEffect(() => {
    if (!profileLoading && profile?.is_active) {
      navigate("/", { replace: true });
    }
  }, [profile, profileLoading, navigate]);

  const startCheckout = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create checkout session");
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="mx-auto mb-4 flex justify-center">
          <img src={flowLogo} width={48} height={48} alt="Flow" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">One last step</h1>
          <p className="text-muted-foreground text-sm">
            Activate your Flow subscription to access the app.
            <br />
            Use code <span className="font-semibold text-foreground">FLOWBETA</span> at checkout for free access.
          </p>
        </div>
        <Button className="w-full" onClick={startCheckout} disabled={loading || profileLoading}>
          {loading ? "Redirecting to checkout…" : "Activate Flow"}
        </Button>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-xs text-muted-foreground">
          Already completed checkout?{" "}
          <button
            className="text-primary hover:underline"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
        </p>
      </div>
    </div>
  );
}
