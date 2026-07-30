import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/executivo/campanhas')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/executivo/campanhas"!</div>
}
