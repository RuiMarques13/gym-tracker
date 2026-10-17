# Gym Tracker

App pessoal para registar treinos e decidir o que fazer a seguir: força, mobilidade e cardio.
Android (Capacitor) e browser. Os dados ficam primeiro no dispositivo (SQLite no Android, sql.js no browser
através do jeep-sqlite) e sincronizam com o Supabase quando há ligação: última alteração ganha, por linha.
Requisitos e fases: documentos «Gym Tracker — requisitos, arquitetura e fases» no projeto.

## Estado

**Feito**
- Exercícios: biblioteca de 1158 (965 força, 155 mobilidade, 38 cardio) e a tua lista; mapa de músculos com fonte; animações.
- Treinos com blocos Aquecimento/Principal, supersets e alvos; Planeados; Ciclos (modelos multi-semana com descargas).
- Sessão: carga, repetições, reserva (RIR), duração, lados, amplitude; **série num toque** com a proposta seguinte;
  − / + na folha; descanso com notificação no Android (ecrã bloqueado); sugestão de carga e «Próxima vez».
- Progressão: estagnação → descarga → mais séries → outra faixa → trocar exercício; sinais de fadiga; objetivos e nível.
- Acompanhamento: volume por músculo, recuperação, gráficos, peso e medidas, fotos, Health Connect (8 leituras).
- Regras e fontes: cada número marcado como estudo ou escolha da app (`core/progression/rules.ts`, ecrã Regras e fontes).
  O 1RM estimado usa Epley em toda a app.
- Conta (Supabase Auth, obrigatória) e sincronização automática; fotos só sincronizam com «Sincronizar fotos» ligado.
- Histórico com correções; exportar/importar JSON (as fotos só entram se escolheres); PWA instalável e offline.
- No browser, o aviso do fim do descanso só toca com a página aberta (a app avisa uma vez e nas Definições).

**Por fazer**
- Testar a sincronização com o PC e o telemóvel reais.
- APK testado num Android real.

## Testes

- `npm run test:core`: Vitest em Node (lógica de `core/`, base de dados com sql.js, servidor Postgres com PGlite,
  regras de arquitetura em `architecture.test.ts`).
- `npm run test:e2e`: Playwright no build de produção, num telemóvel de 390 px, sem rede para o Supabase e com uma
  conta simulada (`e2e/fixtures.ts`). Cobre registar séries, alvos de toque, privacidade das fotos, exportação e regras e fontes.

O CI (`.github/workflows/deploy-web.yml`) corre os dois em cada pull request e em cada push para `main`; só publica
se passarem.

## Requisitos

- Node 20.19+ ou 22.12+
- Para Android: Android Studio (traz o SDK e o JDK)

## Comandos (pasta `app/`)

```bash
npm install            # também copia o sql-wasm.wasm para public/assets (postinstall)
npm start              # app no browser em http://localhost:4200
npm run test:core      # Vitest
npm run build          # build web para www/
npm run test:e2e       # Playwright (depois do build; da primeira vez: npx playwright install chromium)
```

### Versão web publicada (GitHub Pages)

Cada push para `main` corre os testes e publica em `https://ruimarques13.github.io/gym-tracker/`
(workflow `.github/workflows/deploy-web.yml`). Com a conta, o PC e o telemóvel sincronizam.

### Android

```bash
npm run build:android  # build web + cap sync android
npx cap open android   # abre no Android Studio → Run (telemóvel ligado por USB com depuração ativa)
```

### Catálogo de exercícios

`tools/import-excel/catalog.json` é a fonte de verdade. Depois de o editar (ou de importar do Excel),
sobe `version` e gera o seed:

```bash
cd tools/import-excel && npm install
node import-excel.mjs "/caminho/para/o/teu.xlsx" --dry-run   # ver o que entra
node import-excel.mjs "/caminho/para/o/teu.xlsx"             # acrescenta ao catalog.json
node build-seed.mjs                                           # gera app/src/app/data/seed/seed.generated.ts
```

O seed só insere linhas novas: nunca sobrepõe exercícios que editaste, arquivaste ou apagaste.

## Estrutura

```
app/src/app/
  core/               TypeScript puro: recebe dados, devolve decisões (sem Angular, Capacitor nem base)
    progression/      carga, estagnação, fadiga, objetivos, ciclos, sugestões; rules.ts = regras e fontes
    metrics/          volume, recuperação, 1RM, estatísticas da sessão
    anatomy/ library/ motion/   músculos, biblioteca gerada, animações
    health/ timer/ settings/ util/ navigation/   lógica pura de saúde, temporizador, registo de definições
  data/               base local e nuvem, sem Angular
    db/               DbAdapter, adaptadores (SQLite, sql.js), migrações, migrator, local_meta
    models/           tipos de domínio (core pode importá-los)
    repositories/     interfaces + implementações SQLite
    merge/ sync/ seed/ settings/ library/ testing/   LWW, motor de sync, seed, SettingsStore, correções, testes
  services/           ligação ao Angular e aos plugins nativos (services, CLOCK, providers dos repositórios)
  features/           ecrãs
  shared/             componentes partilhados
  architecture.test.ts  impede que core/ importe Angular, plugins, a base ou services/
app/e2e/              testes de ecrã (Playwright) e fixture de conta simulada
tools/import-excel/   catalog.json e gerador do seed (data/seed)
tools/exercise-library/ catálogo da biblioteca (.md) e conversor (core/library)
docs/                 notas técnicas e estudos
```

## Notas técnicas

- **Angular 21, não 22.** O Angular 22 exige Node 22.22.3+; o 21 corre em mais máquinas e é suportado pelo Ionic 9.
- **sql.js fixado em 1.11.0.** O jeep-sqlite 2.8.0 traz embutido o JavaScript do sql.js 1.11.0 e o
  `.wasm` tem de ser exatamente dessa versão (`scripts/copy-wasm.mjs` verifica). Ao atualizar o
  jeep-sqlite, confirmar a versão embutida.
- **`.npmrc` com `legacy-peer-deps`.** Contorna um erro do npm 10 na resolução de dependências do Vitest.
- **Sem índices UNIQUE em nomes**: a unicidade valida-se nos repositórios, para o sync nunca falhar
  por duas linhas com o mesmo nome criadas em dispositivos diferentes.
- **Migrações que reconstroem tabelas** (ex.: 002) usam `disableForeignKeys`: o adaptador desliga as
  chaves estrangeiras, corre a transação, verifica `PRAGMA foreign_key_check` e volta a ligá-las, sem
  gravar a meio (no browser, gravar reabre a base e repõe os PRAGMAs).
- **Migrações em TypeScript** (`001-init.ts`) em vez de `.sql`, para o mesmo ficheiro servir o build e os testes sem configuração extra.
- IDs determinísticos: ver `docs/ids.md`.


## Servidor (Supabase)

O projeto fica em `app/src/app/core/cloud/cloud-config.ts` (URL e chave *publishable*, públicas por desenho).
Nunca pôr aí a chave `service_role` nem a palavra-passe da base de dados.

Aplicar o esquema, uma vez, no SQL Editor do Supabase e por esta ordem:

1. `supabase/migrations/20261010000001_schema.sql`
2. `supabase/migrations/20261010000002_sync.sql`
3. `supabase/migrations/20261010000003_rir.sql` (coluna `rir` das séries; obrigatório antes de usar a versão com RIR)
4. `supabase/migrations/20261010000004_photos.sql` (tabela das fotos de progresso)
5. `supabase/migrations/20261010000005_recovery.sql` (dor percebida por músculo, para o descanso recomendado)

Em Authentication → Providers → Email, para uso pessoal convém desligar «Confirm email»
(ou definir o Site URL em Authentication → URL Configuration) e, depois de criares a conta,
desligar «Allow new users to sign up».
