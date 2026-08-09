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

- Sem sessão em qualquer rota de `/dashboard/*` (incluindo o próprio
  `/dashboard`, o despachante — ver "Navegação" abaixo) → redireciona para
  `/login?callbackUrl=<rota original>`.
- `role !== FAMILY` em `/dashboard/familia/*` → redireciona para `/`.
- `role !== CAREGIVER` em `/dashboard/cuidador/*` → redireciona para `/`.
- Usa `getToken` (não o helper `withAuth`) para ter controle fino por
  prefixo de rota.
- Nota: o Next.js 16 sinaliza depreciação de `middleware.ts` em favor de
  `proxy.ts` — ainda não migrado, é só aviso, não quebra nada por enquanto.

## Navegação (site-header.tsx + back-link.tsx)

**Redirecionamento pós-login: por que saiu da home e virou `/dashboard`**.
Antes, `app/page.tsx` (a home) fazia `getServerSession` + `redirect` pro
dashboard do `role` do usuário — ou seja, a home nunca era *vista* por quem
já estava logado, só existia como uma tela pública, e a barra do cabeçalho
(ver abaixo) escondia a si mesma nessa rota justamente por causa disso. Essa
combinação (home some pra quem já tem conta + header some só na home) parava
de fazer sentido no momento em que o header precisou de um estado "logado"
próprio (item abaixo) — a home passa a ser uma página normal, sempre
visível, e `app/dashboard/page.tsx` é um **despachante** dedicado
(Server Component, só `getServerSession` + `redirect` pro
`/dashboard/familia` ou `/dashboard/cuidador` do `role`) que existe
especificamente pra ser o alvo estável de qualquer link que precise "me leve
pro meu painel" sem saber de antemão qual é o `role` (o menu de conta do
header, o formulário de login quando não há `callbackUrl` na URL). O
`middleware.ts` precisou ganhar `"/dashboard"` (sem `:path*`) no `matcher`
pra continuar protegendo essa rota nova antes mesmo dela renderizar.

`app/components/site-header.tsx` é a barra fina persistente no topo do
site (logo + "Trevo" dentro de um `<Link href="/">`), presente em
**todas** as páginas agora, incluindo a home — antes ela se escondia em
`/` via `usePathname()` num Client Component, mas isso deixou de ser
necessário (e de fazer sentido) quando a home virou uma página que
usuários logados também visitam normalmente. O lado direito do header é
**sensível à sessão**:
- **Sem sessão**: link "Entrar" (`/login`).
- **Com sessão**: `app/components/account-menu.tsx`, um botão com ícone de
  conta (`CircleUserRound`, `lucide-react`) que abre um dropdown com
  "Painel de controle" (`/dashboard`, o despachante acima) e "Sair"
  (`signOut` do NextAuth).

**Decisão técnica — Server Component + um Client Component pequeno, não o
header inteiro em `useSession()`**: `site-header.tsx` voltou a ser um
Server Component (perdeu o `"use client"`/`usePathname()` de quando
precisava se esconder na home) e resolve a sessão com `getServerSession`
— que, na estratégia JWT deste projeto (ver "Autenticação"), só decodifica
o cookie, sem round-trip ao banco, então repetir essa chamada aqui (além
das páginas que já a chamam) é barato. Isso evita o "flash" de estado
deslogado que `useSession()` causaria no primeiro render (client precisa
buscar `/api/auth/session` antes de saber se há sessão). Só a parte
genuinamente interativa — abrir/fechar o dropdown, fechar ao clicar fora
ou apertar Escape — precisa de estado de cliente, por isso só o
`AccountMenu` é `"use client"`, não o header inteiro. Efeito colateral
aceito: páginas que antes eram estáticas no build (`/`, `/login`,
`/cadastro/*`) agora renderizam dinamicamente (ƒ) porque o header em
`app/layout.tsx` chama `getServerSession` em toda requisição — custo
pequeno e esperado pra um header que precisa saber quem está logado em
qualquer rota.

Renderizado no `app/layout.tsx` (raiz), antes de `{children}` — convive
sem conflito com o `BackLink` de cada página de dashboard: o header fica
fixo no topo da página inteira, o `BackLink` fica no topo do conteúdo
específico da tela, logo abaixo dele.

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
  - `findCandidateCaregivers` / `findCandidateFamilies` / `isEligiblePair`:
    filtra por raio máximo + overlap de `careTypes`/`neededCareTypes`.
    `findCandidateFamilies` é genérica (`<F extends FamilyForMatching>`) pra
    funcionar tanto com o `FamilyCandidate` mínimo (Gale-Shapley só precisa
    do `userId` de volta) quanto com o `FamilyForDisplay` mais rico (busca
    do cuidador, que também precisa mostrar nome/cidade/estado).
  - `computeMatchScore`: soma ponderada (*weighted sum model*) dos 4
    critérios normalizados para 0-1 cada.
  - `rankCaregiversForFamily`: busca real usada em `GET /api/search/caregivers`.
  - `rankFamiliesForCaregiver`: o mesmo do outro lado do grafo, busca real
    usada em `GET /api/search/families` (ver "Busca de famílias pelo
    cuidador" abaixo). Por baixo, tanto essa função quanto
    `buildCaregiverPreferences` (Gale-Shapley) chamam o mesmo núcleo
    síncrono `rankFamiliesAgainstList` — extraído de dentro do loop de
    `buildCaregiverPreferences`, que antes tinha essa lógica inline
    duplicada em relação ao que a busca do cuidador precisava, espelhando
    o par `rankCaregiversAgainstList`/`rankCaregiversForFamily` que já
    existia do lado família.
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
- `GET /api/matching/stable-match/caregiver`: mesma ideia, lado cuidador —
  rota separada (não um parâmetro na rota existente) pra manter o
  comportamento já testado do lado família intocado. Roda o mesmo
  `runStableMatchingForAllFamilies()` e devolve `matchesByCaregiver.get(<id
  do cuidador logado>)`. Diferença importante em relação ao lado família:
  como `caregiverCapacity` é 3, a resposta é uma lista de **0 a 3**
  famílias, não um resultado único. Mesma decisão de não inventar
  `distanceKm`/`matchScore` que o lado família já toma (Gale-Shapley não
  produz um score 0-1 comparável — ver "Changelog de decisões" abaixo) e
  mesmo formato limitado por privacidade da busca (sem `address`, ver a
  seguir).
- Scripts de teste permanentes: `scripts/test-matching.ts` e
  `scripts/test-gale-shapley.ts` (rodam com `tsx`, criam dados fictícios,
  imprimem resultado para inspeção manual, limpam ao final). O de
  Gale-Shapley inclui um verificador de pares bloqueantes independente, que
  re-deriva estabilidade a partir das listas de preferência brutas em vez de
  confiar no bookkeeping interno do algoritmo.

## Busca de famílias pelo cuidador

`GET /api/search/families` (`app/api/search/families/route.ts`) é o
espelho de `GET /api/search/caregivers` do outro lado do marketplace —
mesma estrutura (401 sem sessão, 403 se `role !== CAREGIVER`, 400 com
`reason: "incomplete_profile"` se o cuidador não tiver
`latitude`/`longitude` ou `careTypes` vazio), usando `rankFamiliesForCaregiver`
(`lib/matching.ts`) por baixo.

**Limitado por privacidade, de propósito**: o tipo `FamilyForDisplay`
(`lib/matching.ts`) — a forma de `family` dentro do `RankedFamily` que
`rankFamiliesForCaregiver` retorna — carrega só `userId`, `name` (de
`User`), `city`, `state`, `latitude`/`longitude` (usadas para calcular
`distanceKm`, nunca devolvidas cruas) e `neededCareTypes`, mas **nunca
`address`** (o endereço completo da família, armazenado em
`FamilyProfile.address`). Isso não é um descuido nem um esquecimento de
campo: `FamilyForDisplay` simplesmente não carrega `address` nenhuma — não
tem como um consumidor futuro vazar esse dado por engano, porque o tipo não
o expõe. `GET /api/search/families` monta a resposta final a partir disso
(`familyId`, `name`, `city`, `state`, `neededCareTypes`, mais `distanceKm`/
`matchScore` calculados por `rankFamiliesForCaregiver`).
`GET /api/matching/stable-match/caregiver` usa o mesmo subconjunto de
campos privacy-safe, mas busca os perfis direto via Prisma (não passa por
`rankFamiliesForCaregiver`) e por isso **não** inclui `distanceKm`/
`matchScore` — mesma razão já documentada para o lado família em
`GET /api/matching/stable-match`: Gale-Shapley não produz um score 0-1
comparável, então não há o que calcular ali. Diferente do lado família (que
já vê o cuidador por inteiro, já que cuidador não tem endereço de casa
armazenado — ver "Geolocalização"), a família tem um endereço residencial
real, e o cuidador só precisa saber cidade/estado/distância pra decidir se
quer se candidatar — não o endereço exato antes de qualquer contato ter
sido aceito.

`findMatchedFamiliesForCaregiver` (`lib/matching.ts`) espelha
`findMatchedCaregiverForFamily` do outro lado: extrai o lookup "quais
famílias esse cuidador recebeu no Gale-Shapley" pra um só lugar,
compartilhado por `GET /api/matching/stable-match/caregiver` e por
`/dashboard/cuidador/match-perfeito` (Fase 2, abaixo) — nenhum dos dois
reimplementa a busca em `matchesByCaregiver`.

## Telas do cuidador — busca e match perfeito (Fase 2)

Duas páginas novas, espelhando as equivalentes do lado família tela por
tela (mesma estrutura, mesmos componentes reaproveitados de
`app/dashboard/familia/_components/` — `AvatarPlaceholder`,
`MatchScoreRing`, `ConnectionLine` — importados de lá em vez de movidos,
mesmo padrão já usado pela home page, ver "Identidade do site"):

- **`/dashboard/cuidador/buscar`** (`app/dashboard/cuidador/buscar/page.tsx`)
  espelha `/dashboard/familia/buscar`: Server Component chamando
  `rankFamiliesForCaregiver`, barra-resumo somente-leitura (tipos de
  cuidado que o cuidador atende + cidade/estado, com link "Editar perfil"),
  aviso de perfil incompleto (endereço ou `careTypes` vazio) igual ao
  padrão já usado do outro lado. A lista de resultados
  (`app/dashboard/cuidador/buscar/_components/family-results.tsx`,
  `FamilyResults`, Client Component) é o par de `CaregiverResults`, mas
  com **só 2 pílulas de ordenação** ("Mais próximo", "Mais compatível") em
  vez de 3 — `FamilyForDisplay` não carrega nenhuma nota de avaliação
  (famílias não são avaliadas nesta versão, ver "Sistema de Review"), então
  uma pílula "Melhor avaliação" não teria um campo real pra ordenar;
  inventar um valor pra preencher essa lacuna quebraria a mesma regra que
  já vale para `MatchScoreRing`/`ConnectionLine` ("nunca fabricar um número
  que pareça real sem ser"). Cada card mostra `MatchScoreRing` com o
  `matchScore` real, cidade/estado (nunca `address` — a família não tem
  esse campo exposto aqui, ver "Busca de famílias pelo cuidador" acima), e
  o botão **`InteresseButton`**
  (`app/dashboard/cuidador/_components/interesse-button.tsx`) no lugar do
  `ContratarButton` do lado família — mesmo `POST /api/hires`, mas com
  `{ familyId }` no corpo (não `{ caregiverId }`) e o texto "Tenho
  interesse" em vez de "Contratar", já que aqui é o cuidador se oferecendo,
  não sendo contratado. Trata 409 com a mesma mensagem clara de solicitação
  já em andamento, adaptada pro contexto ("...com essa família").
- **`/dashboard/cuidador/match-perfeito`**
  (`app/dashboard/cuidador/match-perfeito/page.tsx`) espelha
  `/dashboard/familia/match-recomendado`, usando
  `findMatchedFamiliesForCaregiver`. Diferença estrutural importante: como
  `caregiverCapacity` é 3, a tela lista **0 a 3 cards** de família (um
  `.map`), não um card único condicional como do lado família (capacidade
  1). Cada card usa o mesmo badge de texto **"Match estável"** (não
  "Recomendado" — nome adaptado, mesmo princípio) e o mesmo
  `ConnectionLine` com `STABLE_MATCH_VISUAL_SCORE = 0.9` fixo — **sem**
  `MatchScoreRing`, mesma razão já documentada: Gale-Shapley não produz um
  score 0-1 comparável. Também tem `InteresseButton` em cada card, para o
  cuidador poder agir direto a partir do match sugerido (mesmo padrão do
  `ContratarButton` em `/match-recomendado`).
- **Links no dashboard** (`app/dashboard/cuidador/page.tsx`): "Buscar
  famílias" (`heroAccentButtonClass`, mesmo destaque que "Buscar
  cuidadores" tem no dashboard da família) e "Match perfeito"
  (`heroOutlineButtonClass`) lado a lado, acima dos cards de resumo
  existentes — mesmo par filled+outline já usado no hero da home
  (`heroButtonClass`/`heroOutlineButtonClass` — aqui com a variante accent
  no lugar de primary, já que "Buscar famílias" é a ação mais importante
  da tela, mesmo papel que `heroAccentButtonClass` já tem documentado em
  `lib/ui.ts`), não um filled+filled: `heroAccentButtonClass` existe
  especificamente para a *uma* ação que deve se destacar de tudo mais na
  tela, então dar a mesma cor de destaque às duas competiria com esse
  propósito.

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
pelas páginas do dashboard, pra evitar que as duas divirjam).

**Marketplace bidirecional**: originalmente só a família podia iniciar um 
`Hire` (o cuidador só respondia). Agora os dois lados podem iniciar contato 
— a família "contrata", o cuidador demonstra "tenho interesse". 
`Hire.initiatedBy` (`HireInitiator`: `FAMILY` | `CAREGIVER`, novo enum) 
registra quem deu o primeiro passo; linhas criadas antes desse campo 
existir têm `@default(FAMILY)` na migration (única leitura possível, já 
que só famílias podiam iniciar até então). Implementado em duas fases: 
**Fase 1** só o backend (schema, `lib/hire-transitions.ts`, 
`POST /api/hires` aceitando os dois papéis, `GET /api/search/families`, 
`GET /api/matching/stable-match/caregiver`); **Fase 2** as telas do lado 
cuidador que usam essa API (ver "Telas do cuidador — busca e match 
perfeito" abaixo) e os ajustes nas duas telas de Hire já existentes para 
não confundir quem iniciou o quê (ver final desta seção).

**Quem pode agir em cada transição depende de quem iniciou**: o lado que 
propôs o `Hire` é quem pode desistir dele enquanto ainda está `PENDING`; o 
outro lado (quem recebeu o convite) é quem decide aceitar ou recusar. Uma 
vez `ACCEPTED`, as regras voltam a ser fixas — independem de quem iniciou, 
porque nesse ponto os papéis já são naturais: o cuidador é sempre quem 
presta o serviço (só ele confirma conclusão) e a família é sempre quem 
recebe o cuidado (só ela pode recuar de um `ACCEPTED`).

| Transição | Iniciado pela família | Iniciado pelo cuidador |
|---|---|---|
| `PENDING → ACCEPTED` | só o cuidador (responde) | só a família (responde) |
| `PENDING → REJECTED` | só o cuidador (responde) | só a família (responde) |
| `PENDING → CANCELLED` | só a família (desiste) | só o cuidador (desiste) |
| `ACCEPTED → COMPLETED` | só o cuidador | só o cuidador |
| `ACCEPTED → CANCELLED` | só a família | só a família |

Qualquer outra transição é rejeitada pela API (`PATCH /api/hires/[id]`) com 
400. `VALID_HIRE_TRANSITIONS` em `lib/hire-transitions.ts` é literalmente 
essa tabela (uma entrada por `HireInitiator`, com as duas últimas linhas — 
que não variam — compartilhando o mesmo objeto `ACCEPTED_TRANSITIONS` em 
vez de duplicado, pra não divergirem por acidente); `isValidHireTransition` 
e `getAvailableActions` ganharam um parâmetro `initiatedBy` a mais.

**Timestamps reais de transição**: `Hire.acceptedAt`/`Hire.completedAt`
(`DateTime?`, migration `add_hire_accepted_completed_at`) registram o
momento exato em que o `PATCH /api/hires/[id]` move o `Hire` para
`ACCEPTED`/`COMPLETED` respectivamente — nenhuma outra transição toca
nesses campos. Não há como reconstruir esses valores retroativamente, então
`Hire`s criados antes dessa mudança ficam com os dois `null` para sempre;
`/dashboard/hires/[id]` (abaixo) trata isso explicitamente, mostrando
"Duração não disponível" em vez de calcular com dado ausente.

**`POST /api/hires` aceita os dois papéis como iniciador** — o corpo da 
requisição muda de acordo com a `session.user.role`, não com um campo 
explícito: família manda `{ caregiverId }` (cria com `initiatedBy: FAMILY`, 
como sempre foi), cuidador manda `{ familyId }` (cria com 
`initiatedBy: CAREGIVER`, novo). Os dois caminhos convergem pra uma única 
função interna (`createHire`) que faz a checagem de solicitação ativa + o 
`prisma.hire.create` — evita duplicar essa lógica entre os dois branches.

**Regra de uma solicitação ativa por par família-cuidador**: não pode existir 
mais de um `Hire` com status `PENDING` ou `ACCEPTED` entre a mesma família e o 
mesmo cuidador simultaneamente. Isso é garantido em duas camadas: uma checagem 
prévia na API (`POST /api/hires`) e, como rede de segurança contra race 
condition, uma constraint `UNIQUE` real no banco sobre o campo 
`Hire.activeHireKey` (`"<familyId>:<caregiverId>"` enquanto ativo, `null` 
quando o Hire chega num estado terminal — Postgres trata múltiplos `NULL` 
como não-conflitantes, então isso permite um novo `Hire` depois que o anterior 
termina). A chave continua montada só a partir do par família+cuidador, 
**independente de quem iniciou** — a regra de "uma solicitação ativa por vez" 
vale igual nos dois sentidos.

Este `Hire` é o pré-requisito do sistema de `Review` que vem a seguir: só faz 
sentido uma família avaliar um cuidador (ou vice-versa) depois de um `Hire` 
`COMPLETED` entre os dois — o schema já modela isso (`Review.hireId` único, 
referenciando um `Hire` específico).

**Tempo relativo (Fase 2)**: `lib/relative-time.ts` (`formatRelativeTime`)
substitui a data absoluta ("Solicitado em DD/MM/AAAA") por texto em
português — "agora mesmo", "há 5 minutos", "há 2 horas", "há 3 dias", "há 2
semanas", "há 3 meses", "há 1 ano" — nos cards de
`/dashboard/familia/contratacoes` e `/dashboard/cuidador/solicitacoes`. A
data absoluta não desapareceu: fica no atributo `title` do `<span>` (tooltip
no hover), então a informação exata continua acessível sem competir
visualmente com o texto relativo. Estilizado com o novo `metaTextClass`
(`lib/ui.ts`) — texto pequeno e `muted`, deliberadamente **sem**
`font-mono`: diferente de um dado verificado (preço, distância, nota), uma
frase relativa ("há 5 minutos") é prosa, não um valor numérico redisplay,
então a convenção de `font-mono` do design system não se aplica aqui.

**Badge de direção (Fase 2)**: como agora um `Hire` pode ter sido iniciado
por qualquer um dos dois lados, uma mesma lista (`/contratacoes` ou
`/solicitacoes`) pode misturar solicitações que a pessoa logada enviou com
solicitações que ela recebeu — sem indicação visual, isso confundiria quem
está vendo a tela. `getHireDirectionLabel(initiatedBy, viewerRole)`
(`lib/hire-labels.ts`) resolve isso do ponto de vista de quem está olhando,
não do dado bruto: retorna **"Você enviou"** se `initiatedBy` bate com o
role de quem está logado, **"Recebido"** caso contrário. Renderizado como
um pill pequeno e discreto (`border-muted/30`, `text-xs`) ao lado do tempo
relativo em cada card, nas duas telas. Título de
`/dashboard/cuidador/solicitacoes` mudou de "Solicitações recebidas" para
**"Minhas solicitações"** pela mesma razão — o nome antigo pressupunha que
a lista só continha pedidos recebidos, o que não é mais verdade.
`/dashboard/familia/contratacoes` manteve "Minhas contratações": o nome já
era neutro o suficiente (não dizia "enviadas" nem "recebidas"), então não
precisou mudar.

Os botões de ação de cada card (incluindo "Cancelar", disponível quando a
pessoa logada é quem propôs um `Hire` ainda `PENDING`) continuam vindo
inteiramente de `getAvailableActions` (`lib/hire-transitions.ts`, já
parametrizada por `initiatedBy` desde a Fase 1) — nenhuma das duas páginas
reimplementa essa lógica, só passam `hire.initiatedBy` adiante.

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

**`StarRating`** (`app/components/star-rating.tsx`): substitui o
`<select>` de "Nota" em `review-form.tsx` por 5 estrelas clicáveis.
Controlado (`value`/`onChange`, mesmo padrão de qualquer input controlado
do projeto), sem estado de validação próprio — a regra "1 a 5, obrigatório"
continua garantida estruturalmente (só existem botões de 1 a 5, nunca um
valor fora desse intervalo ou vazio) e autoritativamente pelo Zod em
`POST /api/reviews`, inalterado. Implementa o padrão ARIA "radio group"
(https://www.w3.org/WAI/ARIA/apg/patterns/radio/): cada estrela é um
`<button role="radio" aria-checked={...}>` com `aria-label` do tipo
"Avaliar com N estrelas", dentro de um container `role="radiogroup"`.
Roving `tabIndex` (só a estrela selecionada tem `tabIndex={0}`, as outras
`-1`) — Tab entra/sai do grupo como uma parada só; dentro dele, as setas
movem o foco *e* selecionam ao mesmo tempo (mesmo comportamento nativo de
um `<input type="radio">` em grupo), e Enter/Espaço confirmam a estrela
focada — de graça, por serem `<button>` nativos, sem handler extra
necessário. O hover é só uma pré-visualização: um estado local
(`hoverValue`) preenche as estrelas até o ponteiro sem chamar `onChange`;
o valor efetivamente selecionado (por clique ou seta) é o que persiste
quando o mouse sai do grupo. Colorido com `fill="currentColor"` +
`text-primary`/`text-muted` — o mesmo truque de `currentColor` já usado por
`ConnectionLine`/`MatchScoreRing`, não a utility `fill-primary` do
Tailwind (nunca testada em produção neste projeto).

**Modo `readOnly`**: usado para mostrar a nota de uma review já existente
(a de outra pessoa, nunca editável ali) — em
`/dashboard/cuidador/avaliacoes` e em `/dashboard/hires/[id]`. `StarRating`
é tipado como união discriminada (`onChange` obrigatório quando
`readOnly` não é `true`; ausente quando é) pra impedir na compilação passar
`onChange` sem sentido num uso somente-leitura. Internamente isso vira dois
componentes internos separados (`InteractiveStarRating` /
`ReadOnlyStarRating`), não um componente só com um `if (readOnly) return`
antes das chamadas de `useState`/`useRef` — isso violaria as Rules of
Hooks (hooks passariam a ser condicionais). O modo somente-leitura também
troca a semântica ARIA: em vez de `role="radiogroup"` com radios
desabilitados (o que sugeriria a um leitor de tela que há um input ali pra
operar), é um `role="img"` estático com `aria-label` tipo "Avaliação: 4 de
5 estrelas".

## Tela de avaliações do cuidador

`/dashboard/cuidador/avaliacoes` (`app/dashboard/cuidador/avaliacoes/page.tsx`):
lista todas as `Review` onde `targetId` é o cuidador logado (`prisma.review.findMany`
com `include: { author: { select: { name: true } } }`, ordenadas por
`createdAt` decrescente). Para cada uma: nome de quem avaliou, nota
(`StarRating readOnly`), comentário (ou "Sem comentário" se vazio/null,
nunca deixado em branco silenciosamente) e tempo relativo
(`formatRelativeTime`, mesmo padrão de `metaTextClass` já usado nas listas
de `Hire`). Subtítulo mostra a média + total via `calculateAverageRating`
(mesma função já usada no dashboard do cuidador) — como `average` é `null`
sem nenhuma review, a mesma condição já cobre a mensagem clara pedida
("Você ainda não recebeu avaliações."), sem precisar de um segundo check
`reviews.length === 0` redundante. O card "Sua avaliação" no dashboard do
cuidador (`app/dashboard/cuidador/page.tsx`) virou um link pra essa página
(era só um `<div>`, mesmo padrão hover dos outros cards do grid).

## Tela de detalhe de um Hire (compartilhada)

`/dashboard/hires/[id]` (`app/dashboard/hires/[id]/page.tsx`) é a única
página do app que não vive sob `/dashboard/familia/*` nem
`/dashboard/cuidador/*` — faz sentido, já que o mesmo `Hire` pertence aos
dois lados, e ambos precisam poder abrir o mesmo detalhe (`BackLink` volta
pra `/dashboard/familia/contratacoes` ou `/dashboard/cuidador/solicitacoes`
dependendo de qual lado é o usuário logado). Linkada como "Ver detalhes"
em cada card das duas listas de `Hire` — deliberadamente um link dentro do
card, não o card inteiro clicável, já que o card já tem botões de ação
(Aceitar/Recusar/Cancelar) que não podem ficar aninhados dentro de outro
elemento clicável (`<a>` dentro de `<a>`/`<button>` é HTML inválido e
quebra o comportamento de clique).

**Verificação de participante — 404 unificado, não 403 separado**: a
página busca o `Hire` pelo `id` da URL e confirma que `familyId` ou
`caregiverId` bate com `session.user.id`; se o `Hire` não existir OU o
usuário logado não for participante, os dois casos caem no mesmo
`notFound()` do Next.js (`next/navigation`) — ao contrário das rotas de
API (que retornam 401/403/404 distintos em JSON), aqui um 403 dedicado
vazaria pra um estranho logado que aquele `id` de `Hire` existe, mesmo que
ele não veja o conteúdo. Colapsar os dois em 404 evita esse vazamento de
existência, um padrão comum em apps que levam a sério não revelar
recursos que não pertencem a quem pergunta.

Conteúdo mostrado: nome da outra parte (`caregiver` se o logado é a
família, `family` caso contrário), status atual, o mesmo badge de direção
de `getHireDirectionLabel` já usado nas listas, mensagem original
(`Hire.message`, se houver), linha do tempo (criado em / aceito em / concluído
em — cada uma com data absoluta *e* relativa, via um `formatTimelineEntry`
local que combina `toLocaleString("pt-BR")` com `formatRelativeTime`), e a
`Review` associada (se existir: nota via `StarRating readOnly`, comentário,
nome de quem avaliou via `review.author`, não assumido como sempre sendo a
família mesmo sabendo que hoje só a família avalia — ver "Sistema de
Review").

**Duração do serviço**: `lib/duration.ts` (`formatDuration`) converte
`completedAt - acceptedAt` (em ms) numa frase de unidade única ("3 dias",
"5 horas") — mesma lógica de "maior unidade aplicável" de
`lib/relative-time.ts`, mas sem o prefixo "há" (aqui é a duração de um
intervalo fixo, não "quanto tempo atrás") e arredondando em vez de
truncando (o intervalo já é fixo quando calculado, então arredondar pro
mais próximo é mais preciso que sempre truncar pra baixo). Se
`acceptedAt` ou `completedAt` estiver ausente (`Hire` antigo de antes da
migration, ou ainda não chegou nesse ponto do fluxo), mostra "Duração não
disponível" em vez de tentar calcular com dado faltando.

## Dashboards

`app/dashboard/familia/page.tsx` e `app/dashboard/cuidador/page.tsx` eram só
uma lista de links — agora mostram cards de resumo (grid responsivo com
`contentCardClass`) além dos links de navegação já existentes, que
continuam intactos abaixo dos cards. Sem rotas de API novas: os dois já são
Server Components com `getServerSession`, então os dados são buscados via
Prisma direto ali, junto com a sessão.

- **Dashboard da família**: simplificado para ficar simétrico ao do
  cuidador (abaixo) — dois botões lado a lado no topo, "Buscar cuidadores"
  (`heroAccentButtonClass`) e "Match recomendado" (`heroOutlineButtonClass`,
  mesmo par filled+outline já usado em "Buscar famílias"/"Match perfeito"
  do cuidador). O card "Match recomendado" que existia antes no grid
  (mostrando o nome do cuidador recomendado direto na tela, via
  `findMatchedCaregiverForFamily`) foi removido — nenhum dos dois botões
  revela informação antes da pessoa clicar e navegar até a página de
  destino, só o link em si. `findMatchedCaregiverForFamily`
  (`lib/matching.ts`) continua existindo e em uso — só não é mais chamada
  aqui, `/dashboard/familia/match-recomendado` (a página de destino) é
  quem ainda a usa.
  - Card "Contratações": `prisma.hire.count` para `PENDING` e `ACCEPTED` da
    família logada (duas queries via `Promise.all`, não uma só com
    `groupBy` — mais simples de ler para só dois status). Único card que
    restou no grid abaixo dos botões, renderizado sozinho (sem `grid-cols-2`
    ao lado de outro card, já que agora é o único).
  - Banner de perfil incompleto: reaproveita o mesmo card
    (`border-primary/20 bg-primary-light`) e texto/link já usados em
    `/dashboard/familia/buscar` para o caso de `neededCareTypes` vazio, em
    vez de inventar um estilo novo para o mesmo aviso.
- **Dashboard do cuidador**: ganhou os links "Buscar famílias"/"Match
  perfeito" acima dos cards na Fase 2 do marketplace bidirecional — ver
  "Telas do cuidador — busca e match perfeito" para os detalhes.
  - Card "Solicitações": `prisma.hire.count` de `PENDING` recebidos. Com
    pelo menos 1 pendente, o card troca para `border-accent`/`bg-accent-light`
    (chamando atenção de que precisa de ação); com zero, é um
    `contentCardClass` normal.
  - Card "Sua avaliação": média + total via `calculateAverageRating`, nova
    função em `lib/reviews.ts` — antes esse cálculo (reduce + divisão) vivia
    duplicado em `GET /api/reviews` e em `lib/matching.ts`
    (`toCaregiverForMatching`); os dois agora importam a mesma função em vez
    de recalcular. Sem nenhuma review, mostra "Sem avaliações ainda" em vez
    de "0" (que pareceria uma nota real, não ausência de dado). O card é um
    link para `/dashboard/cuidador/avaliacoes` (ver "Tela de avaliações do
    cuidador" abaixo) — antes não linkava a lugar nenhum porque essa
    página não existia.
  - Card "Documentos": `prisma.document.count` por `caregiverId` do
    `CaregiverProfile` da sessão. Com zero documentos, o texto é um convite
    ("envie para começar a ser verificado(a)"), não um aviso de erro — só o
    card "Solicitações" usa a cor de alerta (`accent`), porque só ali "zero"
    seria uma notícia ruim; aqui zero documentos é só o estado inicial
    normal de uma conta nova.

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

**Direção visual — histórico**: o site já passou por três paletas. A
original era verde-petróleo/âmbar. Depois veio "Editorial de Confiança"
(preto quase-puro + bordô sobre papel quente, importada de uma exploração
no Claude Design com esse nome), aplicada em duas fases — **Fase A** só a
base (tokens de cor, tipografia de display, hierarquia dos CTAs do hero) e
**Fase B** os componentes específicos que dependiam dela (`MatchScoreRing`,
o placeholder de foto com listras, a barra-resumo e as pílulas de
ordenação de `/buscar`, os links de navegação do header — ver "Componentes
da Fase B" abaixo). A paleta **atual, monocromática oliva sobre creme**,
substitui o preto+bordô da "Editorial de Confiança": `accent` deixou de ser
uma segunda cor de destaque e passou a ser exatamente a mesma cor de
`primary` (ver tabela abaixo) — o site inteiro passou a usar um hue só. Só
os *valores* de cor mudaram nessa última troca; tipografia (Source Serif 4/
Work Sans/JetBrains Mono) e a hierarquia dos CTAs (preenchido vs.
contornado) do hero, ambas decididas na Fase A, continuam as mesmas.

**Paleta** (`app/globals.css`): tons claros/escuros de `primary` são
derivados em HSL a partir do mesmo hue/saturation da cor base, variando só
a lightness — não são valores escolhidos à mão, pra formar uma família
consistente. `accent`/`accent-dark`/`accent-light` não são mais valores
próprios: são `var(--color-primary)`/`var(--color-primary-dark)`/
`var(--color-primary-light)`, uma referência direta, não um literal
duplicado — de propósito, já que essa paleta é monocromática por decisão
(não há uma segunda cor de destaque nesta direção). O token continua
existindo separado porque vários componentes já foram escritos contra
`accent` especificamente (`MatchScoreRing`, a pílula ativa de ordenação,
"Entrar", `accentButtonClass`) — eles continuam funcionando sem alteração
de código, só passam a renderizar na mesma cor de `primary`.

| Token Tailwind | Hex/HSL | Uso |
|---|---|---|
| `primary` | `#5F6E3D` / `hsl(78 29% 34%)` | botão preenchido principal, "Entrar", fundo da seção final "Pronto para começar" |
| `primary-dark` | `hsl(78 29% 26%)` | hover/active de botões primários |
| `primary-light` | `hsl(78 29% 92%)` | tints sutis (badges, avatar placeholder) |
| `accent` | `var(--color-primary)` (mesmo `#5F6E3D`) | idêntico a `primary` — direção monocromática, sem segunda cor de destaque |
| `accent-dark` | `var(--color-primary-dark)` | idem |
| `accent-light` | `var(--color-primary-light)` | idem |
| `background` | `#F8F3E9` | fundo geral (creme) |
| `ink` | `#1C1712` | texto principal (quase-preto, tom quente) |
| `muted` | `#6B645C` | texto secundário, labels, bordas |

**Nota de nomenclatura**: o spec original chamava a cor de texto principal/
secundário de "text-primary"/"text-secondary", mas isso colidiria com o
token `primary` (a cor de marca) — `bg-primary` e `text-primary` teriam
significados diferentes e incompatíveis (marca vs. texto). Renomeados para
`ink`/`muted` pra eliminar a ambiguidade; os valores hex são exatamente os
pedidos em cada direção visual.

**Contraste**: `ink`/`muted` não mudaram nesta troca — o novo `background`
(`#F8F3E9`) é quase idêntico em luminosidade ao anterior (`#F7F3EC`), então
o contraste do texto de corpo continuou adequado sem precisar de ajuste.
`accentButtonClass`/`heroAccentButtonClass` (`lib/ui.ts`) usam `text-white`
sobre `bg-accent` desde a fase "Editorial de Confiança" (quando isso foi
necessário pra corrigir um contraste quebrado contra o bordô escuro daquela
direção — ver histórico no commit) — com `accent` agora igual a `primary`
(`hsl(78 29% 34%)`), o contraste ficou em ~5.5:1, então `text-white`
continua correto sem precisar de outro ajuste.

**A logo mantém cores próprias, independentes do tema**: `app/components/trevo-logo.tsx`
e `app/icon.svg` têm `fill` fixo por `<path>` (mão em `#D9A576`, trevo em
`#2F7A4D` — ver "Identidade do site" abaixo) desde a tarefa que os tirou de
`currentColor`. Nenhuma troca de paleta do restante do site (incluindo
esta) afeta essas duas cores — elas não usam nenhum token de
`app/globals.css`.

**Tipografia**, via `next/font/google` em `app/layout.tsx` (self-hosted — 
baixadas em build time, servidas pelo próprio domínio, sem request pro CDN do 
Google em runtime):
- `font-display` (Source Serif 4, peso 600-700): títulos/headings — trocada
  da Fraunces original nesta mudança de direção, por ser uma serif mais
  "clássica de jornal", mais alinhada à referência editorial
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
um SVG simples (curva + dois pontos) representando família↔cuidador. A
curvatura varia com o `matchScore`: score alto → linha mais reta ("tensa"),
score baixo → linha mais solta. É só decorativo (`aria-hidden`), posicionado
sem competir com nome/match score/preço, que são o foco real do card. Desde
a Fase B (abaixo), só continua em uso em `/dashboard/familia/match-recomendado`
(com a constante `STABLE_MATCH_VISUAL_SCORE = 0.9`, documentada no código) e
no "Como funciona" da home — em `/buscar`, onde existe um score real, foi
substituída pelo `MatchScoreRing`.

**Componentes da Fase B** (`app/dashboard/familia/_components/` e
`app/dashboard/familia/buscar/_components/`), aplicados só onde a regra de
"nunca fabricar um número que pareça real sem ser" permite:

- **`match-score-ring.tsx`** (`MatchScoreRing`): anel de progresso SVG
  (`stroke` em `accent`, trilho em `accent-light`) com a porcentagem
  (`matchScore * 100`, arredondada) no centro. Usado **só** em `/buscar`,
  que tem um `matchScore` 0-1 real vindo de `computeMatchScore`
  (`rankCaregiversForFamily`). **Deliberadamente não usado** em
  `/match-recomendado`: o Gale-Shapley não produz um score 0-1 comparável
  (é um resultado categórico — "este é seu cuidador designado"), então essa
  tela continua com `ConnectionLine` + o badge de texto "Recomendado" em vez
  de inventar um número. Substitui o antigo badge percentual
  (`{Math.round(matchScore * 100)}%` num pill de texto) que existia em
  `/buscar` antes da Fase B — mostrar os dois ao mesmo tempo seria
  redundante.
- **`avatar-placeholder.tsx`** (`AvatarPlaceholder`): substitui o círculo de
  iniciais com fundo sólido (`bg-primary-light`) por um padrão de listras
  diagonais sutil (`repeating-linear-gradient` inline, alternando
  `accent-light` e transparente sobre `bg-white`), com a inicial do nome
  ainda sobreposta no centro — mantém a distinção visual entre cards em uma
  lista, só que com a textura da nova direção em vez de uma cor chapada.
  Usado em `/buscar` e `/match-recomendado`; não tocado em nenhum outro
  lugar (ex.: o card "Match recomendado" do dashboard da família não tem
  avatar, só texto).
- **Barra-resumo de `/buscar`** (`app/dashboard/familia/buscar/page.tsx`):
  chip somente-leitura mostrando os critérios já salvos no perfil da família
  (`neededCareTypes` + `address`/`city`) com um link "Editar perfil" ao
  lado — deliberadamente **não** é um campo de busca por texto livre, porque
  o sistema não tem esse conceito: a busca sempre roda sobre o perfil salvo
  (`neededCareTypes` + localização geocodificada), nunca sobre uma query
  digitada. Só aparece quando a busca de fato rodou (perfil com localização
  e tipos de cuidado completos).
- **Pílulas de ordenação de `/buscar`** (`app/dashboard/familia/buscar/_components/caregiver-results.tsx`,
  `CaregiverResults`, Client Component): "Mais próximo" (por `distanceKm`
  crescente), "Melhor avaliação" (por `averageRating` decrescente, com
  cuidadores sem review nenhum ordenados por último em vez de primeiro —
  tratar "sem dado" como "pior nota" seria enganoso) e "Mais compatível"
  (por `matchScore` decrescente — o padrão inicial, já é como a API retorna
  a lista). Reordena a lista já carregada no cliente (`distanceKm`/
  `averageRating`/`matchScore` já vêm todos na resposta de
  `rankCaregiversForFamily`) — nenhuma chamada nova ao servidor. Essa
  necessidade de interatividade é o motivo de `/buscar` ter ganhado esse
  Client Component: o `page.tsx` continua um Server Component (sessão +
  Prisma), só a lista de resultados (que agora precisa de estado de
  ordenação) foi extraída. Pílula ativa: `bg-accent-light`/`text-accent`;
  inativas: borda neutra com `bg-white`.

**Navegação do header** (`app/components/site-header.tsx`): ganhou uma
`<nav>` com três links — "Para famílias" (`/cadastro/familia`), "Para
cuidadores" (`/cadastro/cuidador`), "Como funciona" (`/#como-funciona`, a
seção já existente na home, que ganhou esse `id`) — visível só em `md:`
pra cima (`hidden md:flex`); em mobile esses links ainda não têm um menu
próprio, fica só a marca + "Entrar"/conta. O link "Entrar" (estado sem
sessão) trocou de `secondaryButtonClass` para `accentButtonClass` — botão
preenchido em bordô, não mais um botão neutro contornado.

**Espaçamento do hero da home**: a seção do hero (`app/page.tsx`) usava
`py-20 sm:py-28` simétrico; o topo ficou `pt-8 sm:pt-10` (o `pb-20 sm:pb-28`
embaixo não mudou) — o cabeçalho fixo já ocupa espaço próprio no topo da
página, então o padding vertical idêntico dos dois lados deixava uma faixa
vazia grande demais entre ele e o logo/tagline do hero.

**Máscara de telefone**: `app/components/phone-input.tsx` envolve o
`PatternFormat` da biblioteca **react-number-format** para aplicar o formato
`(XX) XXXXX-XXXX` em todo campo `phone` do site (cadastro de família,
cadastro de cuidador, edição de perfil de ambos) — escolhida em vez de uma
máscara escrita à mão porque já lida corretamente com posição do cursor,
backspace sobre caracteres da máscara e colagem de texto, e declara suporte
oficial a React 19 (`peerDependencies` inclui `^19.0.0`). O valor propagado
pelo `onChange` do componente é sempre o dígitos-puros (`values.value`), não
a string formatada.

**Validação de telefone completo**: a máscara acima só formata visualmente —
sozinha, ela não impede submissão de um número incompleto (ex.: "(62)
99333-445", 10 dígitos em vez dos 11 de um celular brasileiro válido: 2 do
DDD + 9 do número). `lib/phone.ts` (`PHONE_REGEX`, `isCompletePhone`,
`PHONE_INVALID_MESSAGE = "Telefone inválido — informe DDD + 9 dígitos"`) é a
fonte única dessa regra — mesmo padrão de `lib/age.ts` para a idade mínima:
um só lugar validando, reaproveitado no client e no servidor, pra nunca
divergir.
- **Servidor (autoritativo)**: `phone: z.string().regex(PHONE_REGEX, ...)`
  em `app/api/register/route.ts` (ambos os branches, `FAMILY` e
  `CAREGIVER`, já que `phone` está em `baseFields`, compartilhado pelos
  dois) e `.regex(PHONE_REGEX, ...).optional()` em `app/api/family-profile/route.ts`
  e `app/api/caregiver-profile/route.ts` — nessas duas o campo continua
  opcional (edição de perfil não obriga alterar o telefone), mas *se*
  enviado, precisa bater os 11 dígitos; não há mais como um PATCH salvar um
  telefone incompleto.
- **Cliente (feedback instantâneo)**: os 4 formulários que usam
  `PhoneInput` (`app/cadastro/familia/page.tsx`,
  `app/cadastro/cuidador/page.tsx`, e os dois `profile-form.tsx` de edição
  de perfil) chamam `isCompletePhone` antes do submit, mesmo padrão já
  usado para a data de nascimento. Nos dois formulários de cadastro, onde
  telefone é obrigatório, a checagem dispara sempre que o campo não tem 11
  dígitos. Nos dois formulários de edição de perfil, onde telefone é
  opcional, a checagem só dispara se o campo não estiver vazio
  (`form.phone && !isCompletePhone(form.phone)`) — campo vazio continua
  significando "não alterar o telefone salvo" (`form.phone || undefined`
  no corpo da requisição), não "telefone inválido".

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
a string. O `<title>` da aba (`metadata.title` em `app/layout.tsx`) é só
`siteConfig.name` ("Trevo") — era `"${siteConfig.name} — ${siteConfig.tagline}"`
("Trevo — Cuidado que conecta"); a tagline continua no `<meta description>`
e visível no hero da home, só saiu do texto da aba do navegador.

**Logo**: `app/components/trevo-logo.tsx` — componente React do SVG (ícone de
mão segurando um trevo de três folhas). **Cores fixas por parte, não mais
`currentColor`**: o primeiro `<path>` do arquivo (a mão) tem
`fill="#D9A576"` (tom de pele neutro) e os outros 5 `<path>` (as três
folhas do trevo) têm `fill="#2F7A4D"` (verde), cada um declarado
individualmente no próprio elemento — o `<svg>` raiz não tem mais
`fill="currentColor"`, já que não há mais nada para herdar. Antes disso a
logo era monocromática, herdando cor via Tailwind (`className="text-primary"`
no `<svg>`); os três lugares que passavam essa classe (`app/page.tsx` no
hero e no rodapé, `app/components/site-header.tsx`) tiveram o `text-primary`
removido do `className` por não ter mais efeito nenhum sobre o desenho.
Usado no hero da home (`h-24 w-24`/`h-28 w-28` responsivo — aumentado a
partir de `h-16`/`h-20`, que ficava pequeno demais em relação ao `h1`
"Trevo" logo abaixo), no rodapé (`h-5 w-5`, sem alteração) e no header
(`h-9 w-9`, aumentado de `h-6 w-6`, acompanhado do texto "Trevo" indo de
`text-base` para `text-xl` — os dois cresceram juntos pra manter o
alinhamento vertical entre ícone e texto). `app/icon.svg` é uma cópia do mesmo
desenho com o mesmo esquema de duas cores (favicons não herdam contexto de
CSS, então não há como usar `currentColor`/Tailwind ali) — detectado
automaticamente pelo App Router como favicon, sem config extra em
`layout.tsx`. O `favicon.ico` original do `create-next-app` foi mantido
como fallback para navegadores sem suporte a favicon SVG.

**Home page (`app/page.tsx`)**: pública e **sempre visível**, mesmo pra quem
já está logado — não redireciona mais ninguém (ver "Navegação" acima para o
porquê e onde esse redirecionamento pós-login foi parar). Estrutura, de
cima para baixo:
- **Hero**: logo + nome + tagline + frase curta de proposta + os dois CTAs
  lado a lado (`/cadastro/familia` e `/cadastro/cuidador`). **Reversão da
  decisão original**: os dois CTAs tinham hierarquia visual idêntica (mesmo
  estilo/cor/tamanho, nenhum "mais importante" que o outro) — a direção
  "Editorial de Confiança" (Fase A, ver "Sistema de design") pediu
  explicitamente um botão preenchido ("Sou família, buscar cuidador",
  `heroButtonClass`) e um só contornado ("Sou cuidador, quero atender",
  `heroOutlineButtonClass`, novo em `lib/ui.ts`), priorizando famílias como
  a ação principal do hero. O mesmo par se repete no CTA final da página. O
  hover do botão contornado usa `bg-ink/5` (não `bg-primary-light`) porque
  ele aparece tanto sobre o `background` da página quanto dentro da seção
  final, que já é `bg-primary-light` — um tint de hover igual ao fundo
  ficaria invisível ali. A frase curta de proposta usa vírgula em vez de
  travessão antes de "e para cuidadores encontrarem famílias" — mudança
  puramente de pontuação, mesmo sentido.
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
