import { createFileRoute } from "@tanstack/react-router";
import { MagazineReader } from "@/components/portal/magazine-reader";

const mockEdition = {
  id: "test-edition",
  number: 1,
  title: "Edição de Teste",
  subtitle: "Referência visual editorial",
  coverUrl: null,
  startsOn: "2026-08-01",
  endsOn: "2026-08-10",
  published: true,
  createdByName: "Test",
  createdAt: "2026-08-01T00:00:00Z",
  pages: [
    {
      id: "p1",
      editionId: "test-edition",
      position: 1,
      title: "A Velox em números",
      eyebrow: "Nossa Estrutura",
      body: "A Velox nasceu para simplificar o acesso a soluções financeiras. Hoje, a rede conta com mais de 1.400 unidades espalhadas por todo o Brasil, atuando com crédito, consórcio, seguros, energia solar e benefícios.",
      mediaKind: "imagem" as const,
      mediaUrl: "",
      caption: "",
    },
    {
      id: "p2",
      editionId: "test-edition",
      position: 2,
      title: "O ecossistema de produtos",
      eyebrow: "Modelo de Negócio",
      body: "O franqueado Velox oferece um portfólio completo: crédito consignado, cartões, consórcios, seguros, energia solar e benefícios. Cada produto atende a uma demanda real do brasileiro.",
      mediaKind: "imagem" as const,
      mediaUrl: "",
      caption: "",
    },
    {
      id: "p3",
      editionId: "test-edition",
      position: 3,
      title: "Cultura e princípios",
      eyebrow: "Princípios Velox",
      body: "A Velox é construída por pessoas. Acreditamos em transparência, proximidade e resultados sustentáveis. Não prometemos enriquecimento rápido: oferecemos uma estrutura sólida para quem quer empreender.",
      mediaKind: "imagem" as const,
      mediaUrl: "",
      caption: "",
    },
    {
      id: "p4",
      editionId: "test-edition",
      position: 4,
      title: "Jornada do investidor",
      eyebrow: "Próximos Passos",
      body: "Antes de se tornar franqueado, o investidor passa por uma jornada educativa que explica o modelo, os investimentos, a operação e os cenários de retorno. Tudo de forma transparente.",
      mediaKind: "imagem" as const,
      mediaUrl: "",
      caption: "",
    },
  ],
};

export const Route = createFileRoute("/executivo/testrevista")({
  component: () => (
    <div className="h-screen w-screen">
      <MagazineReader edition={mockEdition} onBack={() => {}} />
    </div>
  ),
});
