import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { DigitalPresentationDialog } from "@/components/executive/digital-presentation-dialog";
import { ExecutiveShell } from "@/components/executive/executive-shell";
import { WorkspaceResourceGuard } from "@/components/executive/workspace-resource-guard";
import { getSession } from "@/lib/executive-auth";

export const Route = createFileRoute("/f/executivo/apresentacao-digital")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Apresentação Digital — Atlas Platform" },
      {
        name: "description",
        content: "Apresentação Digital vigente da Financeira no Corporate Workspace.",
      },
      { property: "og:title", content: "Apresentação Digital — Atlas Platform" },
      {
        property: "og:description",
        content: "Vídeo e texto da Apresentação Digital vigente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApresentacaoDigitalRoute,
});

function ApresentacaoDigitalRoute() {
  const navigate = useNavigate();
  const session = getSession();
  if (!session) return null;

  return (
    <WorkspaceResourceGuard resource="apresentacao_digital">
      <ExecutiveShell session={session} title="Apresentação Digital">
        <DigitalPresentationDialog
          open
          onOpenChange={(open) => {
            if (!open) void navigate({ to: "/f/executivo/home", replace: true });
          }}
        />
      </ExecutiveShell>
    </WorkspaceResourceGuard>
  );
}