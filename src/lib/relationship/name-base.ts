/**
 * BASE DE NOMES RECONHECIDOS (COMANDO 3E §19).
 *
 * A base NÃO precisa conter todos os nomes existentes: ela é uma
 * referência de apoio, alimentável posteriormente com dados públicos
 * (por exemplo, rankings de nomes brasileiros). Nenhuma decisão de
 * personalização depende exclusivamente dela — ver `names.ts`.
 *
 * Os nomes são guardados sem acento e em minúsculas: a comparação é
 * feita sobre a forma dobrada, mas a exibição preserva a acentuação
 * original informada.
 */

/** Remove acentuação apenas para comparação (nunca para exibição). */
export function foldName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

const BASE = [
  // Feminino
  "maria","ana","francisca","antonia","adriana","juliana","marcia","fernanda","patricia","aline",
  "sandra","camila","amanda","bruna","jessica","leticia","julia","luciana","vanessa","mariana",
  "gabriela","valeria","cristina","cristiane","daniela","carla","beatriz","larissa","rafaela","tatiane",
  "simone","claudia","renata","elaine","monica","priscila","luana","isabela","natalia","viviane",
  "eliane","rosana","silvia","talita","debora","carolina","michele","andreia","roberta","raquel",
  "sonia","tereza","vera","helena","alice","laura","manuela","sofia","valentina","heloisa",
  "yasmin","milena","clara","emanuelle","kelly","fabiana","josefa","regina","marta","rita",
  // Masculino
  "jose","joao","antonio","francisco","carlos","paulo","pedro","lucas","luiz","marcos",
  "luis","gabriel","rafael","daniel","marcelo","bruno","eduardo","felipe","raimundo","rodrigo",
  "manoel","mario","sergio","fernando","fabio","andre","ricardo","alexandre","leonardo","roberto",
  "gustavo","tiago","thiago","matheus","vitor","victor","diego","guilherme","alan","milton",
  "renato","anderson","adriano","cesar","claudio","douglas","edson","evandro","fabricio","geraldo",
  "gilberto","henrique","igor","israel","ivan","jefferson","jonathan","jorge","juliano","leandro",
  "marcio","mauricio","murilo","nelson","otavio","patrick","rogerio","ronaldo","samuel","vinicius",
  "wagner","wellington","wesley","william","arthur","bernardo","davi","enzo","miguel","noah",
  "benicio","caio","cauã","emanuel","isaac","joaquim","lorenzo","nicolas","ryan","theo",
] as const;

const NAME_SET = new Set<string>(BASE.map(foldName));

/** O termo é reconhecido pela base de nomes? */
export function isKnownGivenName(token: string): boolean {
  return NAME_SET.has(foldName(token));
}

/** Permite ampliar a base em tempo de execução (dados públicos futuros). */
export function registerGivenNames(names: readonly string[]): void {
  for (const n of names) {
    const folded = foldName(n);
    if (folded) NAME_SET.add(folded);
  }
}

export function knownNameCount(): number {
  return NAME_SET.size;
}