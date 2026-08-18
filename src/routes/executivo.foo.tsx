import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/executivo/foo")({
  component: () => <div data-testid="foo-page">FOO PAGE</div>,
});
