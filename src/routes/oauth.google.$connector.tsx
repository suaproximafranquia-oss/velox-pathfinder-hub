import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeGoogleConnection } from "@/lib/google.functions";

export const Route = createFileRoute("/oauth/google/$connector")({
  component: GoogleOAuthReturn,
  head: () => ({
    meta: [
      { title: "Conexão Google · Portal Velox" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function GoogleOAuthReturn() {
  const { connector } = Route.useParams();
  const [message, setMessage] = useState("Concluindo a conexão com o Google…");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notify = (type: "google-oauth-complete" | "google-oauth-failed") => {
      window.opener?.postMessage({ type, connectorId: connector }, window.location.origin);
      window.close();
    };
    if (params.get("success") !== "true") {
      setMessage(params.get("error") ?? "A autorização não foi concluída.");
      notify("google-oauth-failed");
      return;
    }
    const code = params.get("code");
    if (!code) {
      if (params.get("offline_access_allowed") === "false") {
        notify("google-oauth-complete");
        return;
      }
      setMessage("A autorização terminou sem código de troca.");
      notify("google-oauth-failed");
      return;
    }
    void completeGoogleConnection({ data: { code } })
      .then(() => notify("google-oauth-complete"))
      .catch(() => {
        setMessage("Não foi possível finalizar a conexão.");
        notify("google-oauth-failed");
      });
  }, [connector]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-8 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </main>
  );
}