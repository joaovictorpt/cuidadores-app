# CLAUDE.md

## Sobre o projeto

Site de contratação de cuidadores: um marketplace de dois lados conectando:

- **Famílias** buscando cuidadores (idosos, crianças, pessoas com necessidades especiais, etc.)
- **Cuidadores** oferecendo seus serviços

## Stack

- **Frontend + Backend**: Next.js com TypeScript (App Router)
- **Banco de dados**: PostgreSQL + Prisma como ORM
- **Autenticação**: NextAuth.js (Auth.js)
- **Estilo**: Tailwind CSS
- **Hospedagem planejada**: Vercel (aplicação) + Supabase ou Railway (banco de dados)

## Contexto do desenvolvedor

- Nível intermediário em desenvolvimento web, já fez projetos pequenos.
- Experiência prévia em JavaScript/TypeScript (React, Node).
- Prioridade é aprender enquanto constrói: explique decisões técnicas importantes
  ao longo do caminho, não apenas implemente silenciosamente. Antes de tomar decisões
  arquiteturais relevantes (ex.: modelagem do banco, estrutura de rotas, estratégia de
  autenticação), explique o raciocínio e as alternativas consideradas.

## Convenções de código

- TypeScript em todo o projeto — nada de JavaScript puro.
- Código e comentários em inglês. Explicações no chat podem ser em português.

## Notas para trabalho futuro

- Por ser um marketplace de dois lados, considerar desde cedo: cadastro/perfis distintos
  para famílias e cuidadores, busca/filtros, avaliações e algum fluxo de contato ou contratação.
- Dados sensíveis provavelmente envolvidos (documentos, verificação de identidade/antecedentes,
  informações de saúde) — levar em conta requisitos de privacidade e segurança nas decisões futuras.

## Requisito acadêmico (TCC)

Este projeto também é o TCC do desenvolvedor. Requisitos específicos:

- **Criptografia**: já satisfeito via bcrypt no hash de senhas (cost factor 12).
- **Grafos**: o marketplace deve modelar a relação família-cuidador como um 
  grafo bipartido ponderado (arestas = elegibilidade + peso combinando 
  distância via Haversine, tipo de cuidado, avaliação, preço). Além da busca 
  simples (ordenar arestas por peso), implementar o algoritmo de Gale-Shapley 
  para matching estável entre famílias e cuidadores, como diferencial de 
  fundamentação teórica da banca.

## Autenticação (NextAuth / Auth.js)

Implementado em `lib/auth.ts` (`authOptions`) e `app/api/auth/[...nextauth]/route.ts`:

- **Estratégia de sessão: JWT** (não Database sessions) — escolhido porque o
  `middleware.ts` roda no edge runtime, onde acesso direto ao Postgres via
  Prisma não é viável, e porque evita round-trip ao banco a cada requisição.
- **Provider: `CredentialsProvider`** (email + senha), sem OAuth nesta versão.
  `authorize()` busca o `User` por email e compara a senha com `bcrypt.compare`.
- Callbacks `jwt` e `session` propagam `id` e `role` do usuário para o token
  e para `session.user` — necessário porque o NextAuth não expõe campos
  customizados por padrão (tipagem estendida em `types/next-auth.d.ts`).
- **Cadastro (`POST /api/register`) bloqueia criação de `ADMIN`**: o schema
  Zod usado na validação só aceita `role: "FAMILY" | "CAREGIVER"` como
  discriminated union — mesmo o enum `Role` no Prisma tendo `ADMIN`, esse
  valor nunca é aceito vindo de uma requisição pública. Contas admin
  precisam ser criadas por outro caminho (seed manual, painel interno).
- `User` + `FamilyProfile`/`CaregiverProfile` são sempre criados na mesma
  `prisma.$transaction` — nunca em passos separados, para não deixar um
  `User` órfão sem profile.
- Duplicidade de email: sem checagem prévia — o `@unique` do Postgres barra
  e a API captura o erro `P2002`, retornando 409. Evita condição de corrida
  entre duas requisições simultâneas com o mesmo email.

## Cadastro: campos obrigatórios, maioridade e localização

Campos obrigatórios em `POST /api/register` (schema Zod em
`app/api/register/route.ts`), para os dois branches (`FAMILY` e
`CAREGIVER`): `name`, `birthDate`, `phone`, `city`, `state`. `address` é
obrigatório **só no branch `FAMILY`** — `CaregiverProfile` não tem coluna de
endereço (ver "Geolocalização" abaixo), então não há o que validar como
obrigatório ali; isso não era explícito no pedido original, mas é a única
leitura consistente com o schema atual sem adicionar uma coluna nova.

- **Maioridade (18+)**: `lib/age.ts` (`calculateAge`/`isAdult`,
  `MIN_REGISTRATION_AGE = 18`) é a fonte única da regra, usada tanto no
  `.refine()` do Zod (autoritativo, `app/api/register/route.ts`) quanto nos
  dois formulários de cadastro (`app/cadastro/familia/page.tsx`,
  `app/cadastro/cuidador/page.tsx`) para feedback instantâneo antes mesmo do
  submit — igual ao padrão já usado em `lib/hire-transitions.ts`. Calcula
  idade em anos completos (considera se o aniversário deste ano já passou),
  não uma subtração ingênua de anos.
- **Limites de `birthDate` (1900–hoje)**: além da checagem de 18+, `lib/age.ts`
  (`MIN_BIRTH_DATE`, `isBirthDateInFuture`, `isBirthDateTooOld`,
  `formatDateInputValue`, `parseBirthDateInput` — ver "Sistema de design"
  abaixo para o campo em si) rejeita datas futuras ou anteriores a 1900.
  Aplicado em duas camadas: a checagem client-side antes do submit (mesma
  função, feedback instantâneo) e o `.refine()` autoritativo no Zod
  (`app/api/register/route.ts`) — a ordem dos três `.refine()` encadeados
  ali importa: futuro/muito antigo é checado *antes* da regra de maioridade,
  senão uma data absurda mostra a mensagem confusa "menor de idade" em vez
  de apontar o problema real na data. Antes de virar o campo mascarado
  descrito em "Sistema de design", essa validação também dependia dos
  atributos `min`/`max` de um `<input type="date">` nativo; hoje o campo é
  texto puro, então toda a responsabilidade de bloquear datas fora da faixa
  está nessas duas camadas de código (client + servidor).
- **`User.name`/`User.birthDate`**: `name` já existia no schema mas nunca
  era enviado pelos formulários de cadastro; `birthDate` é campo novo
  (`DateTime?`, migration `add_user_birthdate`). Nenhum dos dois foi
  adicionado às telas de edição de perfil (`profile-form.tsx`) — só ao
  cadastro. As rotas `PATCH /api/caregiver-profile` e
  `PATCH /api/family-profile` continuam sem tocar no model `User`.
- **Mensagem de erro no cliente**: `lib/api-error.ts`
  (`firstApiErrorMessage`) extrai a primeira mensagem de
  `issues.fieldErrors`/`formErrors` da resposta 400 da API — antes disso, o
  formulário só mostrava o texto genérico "Dados inválidos", nunca a
  mensagem específica de qual campo falhou (idade mínima, campo vazio,
  etc.), mesmo a API já retornando isso em `issues`.

## Estado e cidade (combobox com busca, não select nem texto livre)

- `lib/br-states.ts`: lista fixa das 27 UFs (sigla + nome), usada tanto para
  popular as opções de "Estado" quanto para validar server-side
  (`z.enum(BR_STATE_UFS, ...)` em `app/api/register/route.ts`) — uma sigla
  fora da lista nunca é aceita.
- `lib/use-ibge-cities.ts`: hook que busca as cidades do estado escolhido na
  API pública do IBGE
  (`https://servicodados.ibge.gov.br/api/v1/localidades/estados/{UF}/municipios`).
  Falha de rede nunca quebra o formulário — em vez do combobox de cidade,
  o campo cai para um `<input>` de texto livre com um aviso, então o
  cadastro continua possível mesmo com o IBGE fora do ar.
- **`app/components/combobox.tsx`**: combobox acessível genérico (padrão ARIA
  1.2 "combobox with list autocomplete" — `role="combobox"`,
  `aria-expanded`, `aria-controls`, `aria-activedescendant`, listbox com
  `role="option"`/`aria-selected`), navegável por teclado (setas, Enter
  confirma, Escape fecha revertendo). Filtro por substring,
  case-insensitive e **sem sensibilidade a acento** (normaliza via
  `.normalize("NFD")` + `\p{Diacritic}`, então "goias" encontra "Goiás").
  Diferença crucial em relação a um `<input>` comum: o `value` que chega ao
  `onChange` só pode ser um dos `options` — texto digitado que não bate
  com nenhuma opção (exata, após normalização) é descartado no blur,
  revertendo pro último valor válido selecionado. Estilizado com os mesmos
  tokens de `lib/ui.ts` (o dropdown reaproveita `bg-white`/`border-muted`/
  `primary`/`primary-light` do tema).
- `app/components/location-fields.tsx`: componente compartilhado (Estado +
  Cidade, cada um um `Combobox`) usado nos 4 formulários que coletam
  endereço (cadastro e edição de perfil, família e cuidador) — evita
  duplicar a lógica de reset da cidade toda vez que o estado muda. Recebe um
  prop `required` porque cadastro exige os dois campos mas edição de perfil
  não (validação do PATCH continua opcional, só a UI ganhou o combobox).
- Perfis salvos **antes** dessa mudança guardam cidade como texto livre
  (ex.: variações de capitalização/grafia); se o valor salvo não bater
  exatamente com um nome retornado pelo IBGE, o combobox de cidade abre
  vazio na tela de edição — o usuário só precisa reselecionar. Não há
  migração de dados para normalizar isso retroativamente.
- **Histórico**: a versão anterior usava `<select>` nativo do navegador
  (que já bloqueia texto livre por definição — testado e confirmado antes
  desta mudança, digitar no campo não alterava o valor). Um bug de "Estado/
  Cidade aceitando texto livre" foi relatado depois dessa versão ir ao ar,
  mas não foi possível reproduzi-lo rodando o código local — a explicação
  mais provável é teste contra uma versão em cache do navegador ou contra o
  deploy de produção antes dele terminar de atualizar após o último push.
  A troca para combobox com busca (pedida separadamente, ver acima) resolve
  a preocupação de qualquer forma, independente da causa do relato original.

## Proteção de rotas (middleware.ts)

- Sem sessão em qualquer rota de `/dashboard/*` → redireciona para
  `/login?callbackUrl=<rota original>`.
- `role !== FAMILY` em `/dashboard/familia/*` → redireciona para `/`.
- `role !== CAREGIVER` em `/dashboard/cuidador/*` → redireciona para `/`.
- Usa `getToken` (não o helper `withAuth`) para ter controle fino por
  prefixo de rota.
- Nota: o Next.js 16 sinaliza depreciação de `middleware.ts` em favor de
  `proxy.ts` — ainda não migrado, é só aviso, não quebra nada por enquanto.

## Navegação de volta (back-link.tsx)

`app/dashboard/_components/back-link.tsx` é o **padrão oficial** para
qualquer página de dashboard voltar pro dashboard do próprio `role`
(`/dashboard/familia` ou `/dashboard/cuidador`). Existe porque a primeira
leva de páginas foi ao ar sem nenhum link de volta em várias telas
(perfil, busca, match-recomendado, contratações, solicitações, documentos)
— cada uma teria exigido adicionar um botão manualmente, o que já causou
essa inconsistência uma vez.

- **Toda página nova sob `/dashboard/**` deve incluir `<BackLink href="..." />`
  como o primeiro elemento do conteúdo, antes do `<h1>`** — não é opcional,
  é a checklist mínima pra uma página de dashboard ser considerada completa.
- `href` é passado explicitamente pela página chamadora (não é
  auto-detectado a partir da sessão) — toda página de dashboard já roda
  `getServerSession` server-side e sabe o `role` em escopo, então não faz
  sentido o componente refazer esse trabalho num hook client-side
  (`useSession`) só para descobrir o que a página já sabe.
- Estilizado com `secondaryButtonClass` (não `primaryButtonClass`) de
  propósito — nunca deve competir visualmente com o botão de ação principal
  da tela (`Salvar`, `Contratar`, etc.), mesmo padrão visual do "← Voltar"
  já usado em `/cadastro/familia` e `/cadastro/cuidador`.
- Nas duas telas de editar perfil (`app/dashboard/familia/perfil/page.tsx`,
  `app/dashboard/cuidador/perfil/page.tsx`), o `<main>` é `flex items-center
  justify-center` (card único centralizado) — o `BackLink` fica dentro de um
  `<div className="w-full max-w-md">` que envolve `BackLink` + `ProfileForm`
  juntos, pra ele ficar centralizado como uma unidade acima do card, em vez
  de precisar reestruturar o layout centralizado existente. Como o
  `BackLink` está no `page.tsx` (Server Component) e não dentro do
  `ProfileForm` (Client Component), ele nunca desaparece durante o
  salvamento — continua visível e clicável antes, durante, e depois de
  salvar as alterações.

## Banco de dados

- Hospedado no **Supabase** (decisão final — não Railway).
- `datasource db` usa **duas connection strings**: `url` (via connection
  pooler, porta 6543, usada em runtime pela aplicação) e `directUrl`
  (conexão direta, porta 5432, usada só pelo Prisma CLI para migrations).
  Sem isso, `prisma migrate` falha ou trava contra o pooler do Supabase.

## Perfis editáveis

- `app/api/caregiver-profile/route.ts` e `app/api/family-profile/route.ts`
  (GET + PATCH): sempre exigem sessão (401) e checam que o `role` da sessão
  bate com o tipo de perfil (403 caso contrário). `userId` sempre vem da
  sessão, nunca do corpo da requisição.
- O campo `verified` do `CaregiverProfile` **nunca** é editável via essa
  rota — o schema Zod de update não o declara, e o Zod descarta por padrão
  (modo "strip") qualquer campo não declarado enviado no corpo.
- Páginas: `app/dashboard/cuidador/perfil/page.tsx` e
  `app/dashboard/familia/perfil/page.tsx`, cada uma com Server Component
  (busca via Prisma direto) + Client Component (formulário).

## Geolocalização

- Campos `latitude`/`longitude` (`Float?`, opcionais) em `FamilyProfile` e
  `CaregiverProfile`.
- `lib/geocoding.ts`: `geocodeAddress()` chama o **Nominatim** (OpenStreetMap,
  gratuito), com `User-Agent` identificando a aplicação e uma fila que
  serializa chamadas com no mínimo 1s de intervalo entre elas (throttle em
  memória, por processo — não coordena entre múltiplas instâncias caso o
  app rode serverless/multi-processo no futuro).
- Geocodificação roda **sempre fora de qualquer transação Prisma** (nunca
  dentro de `$transaction`) — chamada de rede não deve seguir lock de banco.
- Falha de geocodificação (endereço não encontrado, erro de rede) nunca
  bloqueia cadastro/edição — apenas deixa `latitude`/`longitude` como `null`.
- Nos endpoints de edição de perfil, só re-geocodifica se o endereço
  (`city`/`state`/`address`) realmente mudou em relação ao valor salvo —
  evita chamadas desnecessárias ao Nominatim.

## Algoritmo de matching (núcleo acadêmico do TCC)

- `FamilyProfile.neededCareTypes: CareType[]` — tipos de cuidado que a
  família procura (mesmo enum `CareType` já usado em `CaregiverProfile.careTypes`).
- `lib/matching-config.ts`: pesos configuráveis (`distance`,
  `careTypeCompatibility`, `rating`, `price` — devem somar 1.0),
  `maxDistanceKm` (raio de elegibilidade, hoje 50km),
  `defaultRatingWhenNoReviews` (0.5, para não penalizar cuidadores novos sem
  reviews), `caregiverCapacity` (3, usado pelo Gale-Shapley).
- `lib/haversine.ts`: distância em linha reta entre duas coordenadas.
- `lib/matching.ts`:
  - `findCandidateCaregivers` / `isEligiblePair`: filtra por raio máximo +
    overlap de `careTypes`/`neededCareTypes`.
  - `computeMatchScore`: soma ponderada (*weighted sum model*) dos 4
    critérios normalizados para 0-1 cada.
  - `rankCaregiversForFamily`: busca real usada em `GET /api/search/caregivers`.
  - `buildFamilyPreferences` / `buildCaregiverPreferences`: listas de
    preferência para o Gale-Shapley, reaproveitando a mesma fórmula de score
    nos dois sentidos (consequência: do lado do cuidador, `rating` e `price`
    acabam constantes — só distância e compatibilidade discriminam).
- `lib/gale-shapley.ts`: `stableMatching()` genérica, implementando a
  variante **hospital-residents** (capacidade > 1 do lado que recebe —
  o mesmo tipo usado em alocação de residência médica), não o problema
  clássico 1-para-1. Resultado é **proposer-optimal** (cada família recebe o
  melhor cuidador possível entre todos os matchings estáveis existentes).
- `GET /api/matching/stable-match`: roda o matching global e retorna o
  resultado da família logada. Comentário no código aponta que recalcular
  tudo a cada requisição não escala — candidato a cache/job assíncrono se o
  volume de usuários crescer.
- Scripts de teste permanentes: `scripts/test-matching.ts` e
  `scripts/test-gale-shapley.ts` (rodam com `tsx`, criam dados fictícios,
  imprimem resultado para inspeção manual, limpam ao final). O de
  Gale-Shapley inclui um verificador de pares bloqueantes independente, que
  re-deriva estabilidade a partir das listas de preferência brutas em vez de
  confiar no bookkeeping interno do algoritmo.

## Changelog de decisões

- **Resolvido**: `GET /api/search/caregivers` retornava lista vazia sem
  explicação quando `FamilyProfile.neededCareTypes` da família logada estava
  vazio (sem overlap possível com conjunto vazio). Agora detecta esse caso
  *antes* de rodar `rankCaregiversForFamily` e retorna 400 com
  `{ error, reason: "incomplete_profile" }` — o campo `reason` existe
  especificamente para a UI (ou qualquer outro consumidor futuro) diferenciar
  isso de um erro de validação de entrada, já que o problema está no perfil
  salvo, não no que foi enviado na requisição. `app/dashboard/familia/buscar/page.tsx`
  trata o mesmo caso (replicando a checagem, já que a página chama
  `rankCaregiversForFamily` direto via Prisma, sem passar pela API) mostrando
  um card com link para `/dashboard/familia/perfil`, em vez do texto genérico
  de "nenhum resultado".
- **Intencional**: a menção textual ao algoritmo "Gale-Shapley" foi removida
  de `app/dashboard/familia/match-recomendado/page.tsx` — nome de algoritmo é
  detalhe de implementação interna, não deveria vazar pra UI que a família
  vê. A explicação do algoritmo permanece como comentário técnico no próprio
  código (perto de `STABLE_MATCH_VISUAL_SCORE`), só o texto visível na tela
  mudou.

## Fluxo de contratação (Hire)

Implementado como uma máquina de estados sobre o model `Hire` já existente no 
schema (`prisma/schema.prisma`), com as regras centralizadas em 
`lib/hire-transitions.ts` (única fonte de verdade, usada tanto pela API quanto 
pelas páginas do dashboard, pra evitar que as duas divirjam):

- `PENDING → ACCEPTED` (só o cuidador)
- `PENDING → REJECTED` (só o cuidador)
- `PENDING → CANCELLED` (só a família)
- `ACCEPTED → COMPLETED` (só o cuidador)
- `ACCEPTED → CANCELLED` (só a família)
- Qualquer outra transição é rejeitada pela API (`PATCH /api/hires/[id]`) com 400.

**Regra de uma solicitação ativa por par família-cuidador**: não pode existir 
mais de um `Hire` com status `PENDING` ou `ACCEPTED` entre a mesma família e o 
mesmo cuidador simultaneamente. Isso é garantido em duas camadas: uma checagem 
prévia na API (`POST /api/hires`) e, como rede de segurança contra race 
condition, uma constraint `UNIQUE` real no banco sobre o campo 
`Hire.activeHireKey` (`"<familyId>:<caregiverId>"` enquanto ativo, `null` 
quando o Hire chega num estado terminal — Postgres trata múltiplos `NULL` 
como não-conflitantes, então isso permite um novo `Hire` depois que o anterior 
termina).

Este `Hire` é o pré-requisito do sistema de `Review` que vem a seguir: só faz 
sentido uma família avaliar um cuidador (ou vice-versa) depois de um `Hire` 
`COMPLETED` entre os dois — o schema já modela isso (`Review.hireId` único, 
referenciando um `Hire` específico).

## Sistema de Review

Implementado sobre o model `Review` já existente no schema 
(`app/api/reviews/route.ts`), com as seguintes regras:

- **Só a família avalia o cuidador** (não o contrário, nesta versão) — 
  `authorId` é sempre a família da sessão, `targetId` é sempre o 
  `caregiverId` do `Hire`.
- **Só depois do `Hire` estar `COMPLETED`** — tentar avaliar um `Hire` 
  `PENDING`/`ACCEPTED`/`REJECTED`/`CANCELLED` retorna 400.
- **Uma review por `Hire`**, garantido pelo `@unique` já existente em 
  `Review.hireId` no schema — a segunda tentativa de review pro mesmo `Hire` 
  é barrada tanto por uma checagem prévia (implícita, já que o `Hire` só 
  pode ter uma `Review`) quanto pela constraint do banco como rede de 
  segurança contra race condition (mesmo padrão usado no cadastro de email 
  duplicado e no fluxo de `Hire`).
- **Sem edição nem remoção nesta versão** — uma vez criada, a review é 
  permanente. Se isso mudar no futuro, precisa de uma decisão explícita 
  sobre quem pode editar/remover e até quando.
- `GET /api/reviews?caregiverId=...` é uma rota pública (sem exigir sessão) 
  — visitantes não autenticados podem ver as avaliações de um cuidador antes 
  de se cadastrar.

## Sistema de design

Aplicado em todo o site: tema global, `/login`, `/cadastro` (+ `/familia` +
`/cuidador`), `/dashboard/familia/buscar`, `/dashboard/familia` e
`/dashboard/cuidador` (telas iniciais), perfis (`/dashboard/familia/perfil`,
`/dashboard/cuidador/perfil`), contratações/solicitações
(`/dashboard/familia/contratacoes`, `/dashboard/cuidador/solicitacoes`,
incluindo `hire-action-button.tsx` e `review-form.tsx`), e
`/dashboard/familia/match-recomendado` (que também ganhou o `ConnectionLine`,
com `matchScore` fixo em 0.9 já que o Gale-Shapley não produz um score 0-1
como a busca — documentado no código). Único ajuste visual pontual: o
badge de compatibilidade em `match-recomendado` é texto ("Recomendado"),
não uma porcentagem, pela mesma razão. Centralizado em `lib/ui.ts` (classes
reutilizáveis) e `app/globals.css` (tokens do tema, via `@theme inline` — ver
nota sobre Tailwind v4 abaixo).

**Paleta** (`app/globals.css`): tons claros/escuros de `primary` e `accent` 
são derivados em HSL a partir do mesmo hue/saturation da cor base, variando 
só a lightness — não são valores escolhidos à mão, pra formar uma família 
consistente.

| Token Tailwind | Hex/HSL | Uso |
|---|---|---|
| `primary` | `#1F5C56` / `hsl(174 50% 24%)` | botões primários, links, ícones ativos |
| `primary-dark` | `hsl(174 50% 18%)` | hover/active de botões primários |
| `primary-light` | `hsl(174 50% 94%)` | tints sutis (badges, avatar placeholder) |
| `accent` | `#E3A438` / `hsl(38 75% 55%)` | CTAs de destaque: "Contratar", "Aceitar" |
| `accent-dark` | `hsl(38 75% 45%)` | hover/active de botões accent |
| `accent-light` | `hsl(38 75% 92%)` | tints sutis |
| `background` | `#F5F7F3` | fundo geral |
| `ink` | `#1B2B2A` | texto principal |
| `muted` | `#6B8783` | texto secundário, labels, bordas |

**Nota de nomenclatura**: o spec original chamava `#1B2B2A`/`#6B8783` de 
"text-primary"/"text-secondary", mas isso colidiria com o token `primary` (a 
cor de marca) — `bg-primary` e `text-primary` teriam significados diferentes 
e incompatíveis (marca vs. texto). Renomeados para `ink`/`muted` pra eliminar 
a ambiguidade; os valores hex são exatamente os pedidos.

**Tipografia**, via `next/font/google` em `app/layout.tsx` (self-hosted — 
baixadas em build time, servidas pelo próprio domínio, sem request pro CDN do 
Google em runtime):
- `font-display` (Fraunces, peso 600-700): títulos/headings
- `font-sans` (Work Sans): corpo, labels, botões — é a fonte padrão do `body`
- `font-mono` (JetBrains Mono): dados/números *exibidos* (preço, distância, 
  nota, % de match) — não usada em campos de formulário, só em valores já 
  computados/verificados sendo mostrados de volta pro usuário (ex.: cards de 
  `/buscar`), que é a leitura mais literal de "dado verificado" do spec.

**Radius de card**: token `--radius-card: 0.875rem` (14px, dentro da faixa 
12-16px pedida) → classe `rounded-card`.

**Foco de teclado**: todo elemento interativo tocado usa 
`focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary` 
em vez do outline default do navegador — nunca `outline-none` sem substituto.

**Movimento**: toda `transition` adicionada tem `motion-reduce:transition-none` 
ao lado, respeitando `prefers-reduced-motion`.

**Elemento de assinatura — linha de conexão**: `app/dashboard/familia/_components/connection-line.tsx`, 
um SVG simples (curva + dois pontos) representando família↔cuidador, usado 
nos cards de `/dashboard/familia/buscar` e `/dashboard/familia/match-recomendado` 
(e no "Como funciona" da home — ver seção "Identidade do site"). A curvatura 
varia com o `matchScore`: score alto → linha mais reta ("tensa"), score baixo 
→ linha mais solta. Em `match-recomendado`, como não existe um score real, 
usa-se uma constante 0.9, documentada no código. É só decorativo 
(`aria-hidden`), posicionado sem competir com nome/match score/preço, que são 
o foco real do card.

**Máscara de telefone**: `app/components/phone-input.tsx` envolve o
`PatternFormat` da biblioteca **react-number-format** para aplicar o formato
`(XX) XXXXX-XXXX` em todo campo `phone` do site (cadastro de família,
cadastro de cuidador, edição de perfil de ambos) — escolhida em vez de uma
máscara escrita à mão porque já lida corretamente com posição do cursor,
backspace sobre caracteres da máscara e colagem de texto, e declara suporte
oficial a React 19 (`peerDependencies` inclui `^19.0.0`). O valor propagado
pelo `onChange` do componente é sempre o dígitos-puros (`values.value`), não
a string formatada.

**Máscara de data de nascimento**: `app/components/birth-date-input.tsx`
segue exatamente o mesmo padrão do `phone-input.tsx` acima — `PatternFormat`
com formato `##/##/####` e placeholder `dd/mm/aaaa`, em vez do
`<input type="date">` nativo usado originalmente. Motivo da troca: o destaque
em bloco azul que o navegador desenha nos segmentos (dia/mês/ano) de um
input de data nativo **não é estilizável via CSS** — não dá pra fazer esse
destaque seguir a paleta do tema (`primary`, etc.), então o campo nunca
ficaria visualmente consistente com o resto do formulário. Com o campo
sendo texto puro, `lib/age.ts` (`parseBirthDateInput`) ganhou a
responsabilidade de converter "DD/MM/AAAA" digitado em `Date` antes de
qualquer validação — a parte não óbvia ali é a técnica de "round-trip" para
pegar datas impossíveis: `new Date(ano, mes, dia)` do JavaScript nunca
lança erro para um dia inválido (ex.: `new Date(2020, 1, 31)`, 31 de
fevereiro) — ele "rola" silenciosamente pra frente (vira 2 ou 3 de março).
`parseBirthDateInput` reconstrói a data a partir dos três números digitados
e compara `getFullYear()`/`getMonth()`/`getDate()` do resultado contra o que
foi digitado; se não bater exatamente, a data é rejeitada como impossível
em vez de silenciosamente virar uma data diferente da que o usuário quis.

**Bloquear scroll em inputs numéricos**: convenção do projeto, não específica
de nenhum campo — todo `<input type="number">` novo deve receber
`onWheel={(e) => e.currentTarget.blur()}` (centralizado como `blurOnWheel`
em `lib/ui.ts`, para não repetir a lógica em cada input). Motivo: navegadores
alteram o valor de um input numérico focado ao rolar o scroll do mouse sobre
ele — um comportamento nativo *separado* das setinhas de incremento/
decremento (que já são escondidas via CSS em `app/globals.css`) e que
`preventDefault()` sozinho no evento `wheel` não bloqueia de forma
confiável em todos os navegadores. Tirar o foco do campo ao detectar
`wheel` é o jeito simples e confiável de resolver isso, e não interfere na
rolagem normal da página. Aplicado hoje em `hourlyRate` e `experienceYears`
(cadastro e edição de perfil de cuidador).

**Nota técnica — Tailwind v4**: este projeto não tem `tailwind.config.ts` — o 
Tailwind v4 usa config CSS-first via `@theme` dentro de `app/globals.css`, 
não um arquivo JS/TS separado. Os tokens de cor/fonte/radius viram utilities 
automaticamente (`--color-primary` → `bg-primary`/`text-primary`/etc., 
`--radius-card` → `rounded-card`).

## Verificação de documentos

Upload de documentos do cuidador (`Document` model, já existente no schema) 
para o Supabase Storage, **sem fluxo de aprovação/rejeição implementado**:

- **Bucket privado + signed URLs**: `caregiver-documents` é um bucket privado 
  no Supabase (não público), porque documento de identidade/antecedentes 
  criminais é dado sensível. `Document.fileUrl` guarda só o *caminho* do 
  arquivo no bucket (`{caregiverProfileId}/{uuid}-{nome}`), nunca uma URL 
  pública. Toda visualização passa por `createSignedUrls` 
  (`lib/documents.ts`), gerando links temporários (5 minutos) sob demanda — 
  ninguém acessa o arquivo sem antes provar que é o dono (ou, no futuro, um 
  admin autorizado).
- **`lib/supabase-admin.ts`** usa a `SUPABASE_SERVICE_ROLE_KEY`, que ignora 
  Row Level Security e tem acesso total ao projeto Supabase inteiro — client 
  **só pode ser importado em código server-side** (Route Handlers, Server 
  Components). Nunca num Client Component; isso vazaria a service_role key 
  pro navegador.
- **Validação de upload**: só PDF/JPG/PNG (`ALLOWED_MIME_TYPES` em 
  `app/api/documents/route.ts`), até 5MB. Se o insert no banco falhar depois 
  do upload pro Storage já ter dado certo, o arquivo é removido do bucket 
  (evita órfão).
- **Remoção só com `status: PENDING`**: a checagem já existe em 
  `DELETE /api/documents/[id]` mesmo sem nenhum caminho no código que mude 
  esse status hoje — é preparação deliberada para quando o fluxo de análise 
  existir (todo documento fica `PENDING` para sempre, por enquanto).
- **Fora do escopo atual (extensão futura deliberada)**: fluxo de 
  aprovação/rejeição por um admin (mudar `Document.status` para `APPROVED`/
  `REJECTED`, preencher `reviewedAt`, e provavelmente atualizar 
  `CaregiverProfile.verified`). A estrutura de dados 
  (`Document.status: VerificationStatus`, `reviewedAt: DateTime?`) já 
  suporta isso — só falta o painel/rota que faz a análise, que não existe 
  ainda porque não há papel de `ADMIN` operacional no app hoje.

## Identidade do site

Nome: **Trevo**. Tagline: **"Cuidado que conecta"**. Esses dois valores 
vivem centralizados em `lib/site-config.ts` (`siteConfig.name` / 
`siteConfig.tagline`) — nunca hardcoded direto numa página. Hoje são usados 
em `app/layout.tsx` (título/descrição da página) e `app/page.tsx` (hero e 
rodapé); qualquer lugar novo que precisar do nome/tagline do site (emails 
transacionais, outras páginas de marketing) deve importar dali, não repetir 
a string.

**Logo**: `app/components/trevo-logo.tsx` — componente React do SVG (ícone de
trevo), `fill="currentColor"` no elemento raiz para herdar cor via Tailwind
(`className="text-primary"` etc.) em vez de cor fixa. Usado no hero da home
(`h-16 w-16`/`h-20 w-20` responsivo) e no rodapé (`h-5 w-5`), sempre em
`primary`. `app/icon.svg` é uma cópia com `fill="#1F5C56"` fixo (favicons não
herdam contexto de CSS) — detectado automaticamente pelo App Router como
favicon, sem config extra em `layout.tsx`. O `favicon.ico` original do
`create-next-app` foi mantido como fallback para navegadores sem suporte a
favicon SVG.

**Home page (`app/page.tsx`)**: pública, mas usuário já logado é 
redirecionado automaticamente pro dashboard do seu `role` (`getServerSession` 
+ `redirect`, sem passar pelo `middleware.ts` — o matcher dele não cobre `/`). 
Estrutura, de cima para baixo:
- **Hero**: logo + nome + tagline + frase curta de proposta + os dois CTAs
  lado a lado (`/cadastro/familia` e `/cadastro/cuidador`), com **hierarquia
  visual idêntica** entre os dois (mesmo estilo/cor/tamanho) — nenhum é "mais 
  importante" que o outro.
- **Como funciona**: 3 passos com ícone (`lucide-react`), conectados 
  visualmente pelo mesmo `ConnectionLine` já usado em `/buscar` e 
  `/match-recomendado` (reforça a metáfora de "conexão" da tagline). O 
  componente continua fisicamente em 
  `app/dashboard/familia/_components/connection-line.tsx` — a home importa 
  de lá em vez de mover o arquivo, pra não mexer nos imports das outras 
  páginas que já o usam.
- **Por que confiar**: 3 pontos (senha criptografada, documentos verificados, 
  avaliações reais).
- **CTA final**: repete os dois botões do hero antes do rodapé.
- **Rodapé**: logo pequena + nome do site + ano calculado via
  `new Date().getFullYear()` (nunca um ano fixo).

Dois novos tokens em `lib/ui.ts` pra isso: `heroButtonClass` (CTA grande, 
full-width no mobile / lado a lado em telas maiores — `primaryButtonClass` 
já existente é dimensionado pra botão de formulário, pequeno demais pra 
hero) e `contentCardClass` (card de conteúdo genérico pra grid, mesma 
linguagem visual do `cardClass` mas sem a largura máxima fixa).

## Deploy (Vercel)

Aplicação publicada na Vercel, conectada ao repositório GitHub
(`github.com/joaovictorpt/cuidadores-app`) via integração nativa — todo push
na branch `main` dispara um deploy automático de produção, sem passo manual.

- **`"build": "prisma generate && next build"`** — o script `build` chama
  `prisma generate` explicitamente antes do `next build`, em vez de confiar
  só no `postinstall` (que também existe, como rede de segurança redundante,
  ver abaixo). Motivo: um deploy quebrou em produção com o erro "Property
  `birthDate` does not exist" logo depois da migration que adicionou esse
  campo — o `schema.prisma` já tinha a coluna nova, mas o `@prisma/client`
  gerado (que fica em `node_modules/.prisma/client`, incluído no cache de
  dependências da Vercel entre builds) ainda era da versão anterior do
  schema. **Causa raiz real, não só teórica**: ao investigar, o
  `"postinstall": "prisma generate"` mencionado neste documento nunca tinha
  sido efetivamente adicionado ao `package.json` (só existia aqui na
  documentação) — então não havia *nenhum* passo garantindo Prisma Client
  atualizado no build, cache ou não. Isso já foi corrigido (`postinstall`
  agora existe de verdade, ver abaixo), mas o `prisma generate` explícito no
  `build` fica como proteção adicional independente disso: mesmo se o
  `postinstall` for pulado (a Vercel pode reaproveitar `node_modules` do
  cache sem rodar hooks de instalação quando nenhuma dependência declarada
  mudou — só o schema, que não é uma dependência do npm), o `build` gera o
  client de novo de qualquer forma. As duas entradas coexistem de propósito:
  redundância segura, não conflito.
- **`package.json` também tem `"postinstall": "prisma generate"`** —
  mesma necessidade (Prisma Client sincronizado com o schema), só que
  disparado em qualquer `npm install` (local ou CI), não só no `build` da
  Vercel.
- **Banco de dados**: mesma instância do Supabase usada em desenvolvimento
  (não há ambiente de staging/produção separado — decisão consciente de
  simplicidade para o escopo de TCC, não recomendada para um produto real
  com usuários de verdade).
- **Variáveis de ambiente configuradas nas Environment Variables do projeto
  na Vercel** (mesmos nomes do `.env` local): `DATABASE_URL`, `DIRECT_URL`,
  `NEXTAUTH_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, e
  `NEXTAUTH_URL` (**esta precisa ser o domínio de produção real,
  `https://cuidadores-app.vercel.app` — não `localhost`**; sem isso o login
  falha em produção).
- Domínio de produção estável: `cuidadores-app.vercel.app` (a Vercel também
  gera uma URL única por deploy, com hash, que não deve ser usada em nenhuma
  variável de ambiente por não ser permanente).

## Dados de demonstração

`scripts/seed-demo.ts` gera dados fictícios (5 cuidadores, 3 famílias,
contratações e avaliações) para usar ao vivo na apresentação do TCC. Roda com
`npm run seed:demo`.

- **Idempotente**: apaga todo dado de demonstração anterior antes de inserir
  qualquer coisa (identificado pelo domínio de email exclusivo
  `@demo.trevo.app`) — pode rodar de novo a qualquer momento sem duplicar
  registros nem acumular lixo de execuções passadas.
- **Roda contra o mesmo banco Supabase de produção** (não há staging
  separado — mesma decisão já registrada na seção "Deploy (Vercel)"). Por
  isso o script nunca deve ser executado sem confirmação explícita antes.
- Endereços reais na região metropolitana de Goiânia (Goiânia, Aparecida de
  Goiânia, Trindade, Senador Canedo), geocodificados de verdade via
  `lib/geocoding.ts` — não há latitude/longitude hardcoded — para que busca e
  matching produzam resultados coerentes na demo.
- Todos os usuários demo (família e cuidador) compartilham a senha
  `Demo@2026`, hasheada com bcrypt como qualquer outro usuário. Ao final da
  execução, o script imprime uma tabela com email/senha/role de cada
  conta criada, para consulta rápida durante a apresentação.
- `scripts/cleanup-demo.ts` (`npm run cleanup:demo`) remove os dados de
  demonstração **sem recriá-los** — útil para simplesmente limpar o banco
  depois da apresentação, sem rodar o seed completo (e sem esperar a
  geocodificação) de novo. Reaproveita a mesma função `cleanup()` exportada
  de `scripts/seed-demo.ts` em vez de duplicar a lógica; `seed-demo.ts` só
  executa seu próprio `main()` quando rodado diretamente (`require.main ===
  module`), então importar `cleanup` dali não dispara um seed completo como
  efeito colateral.
