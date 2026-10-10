# Gym Tracker

App pessoal para planear e registar treinos de força e mobilidade. Local primeiro (SQLite no
dispositivo), Android e browser no PC, sync na Fase 3. Requisitos e fases: documento
«Gym Tracker — requisitos, arquitetura e fases» (v2) no projeto.

## Estado: Fases 0, 1 e 2 concluídas; Fase 3 (sync) em curso

- [x] Projeto Ionic 9 + Angular 21 (standalone, sem zone.js) + Capacitor 8, alvos web e Android
- [x] `DbAdapter` com três implementações: SQLite nativo (Android), jeep-sqlite (browser), sql.js (testes)
- [x] Migrações versionadas, cada uma numa transação (`001-init`: todas as tabelas da secção 6, com campos de sync)
- [x] `device_id` persistido, relógio injetável, UUID v4/v5
- [x] Registo central de definições + `SettingsService` (signals), três âmbitos
- [x] Seed com IDs determinísticos; a v4 já não cria exercícios: os 39 de origem foram retirados (a biblioteca tem-nos, mobilidade incluída) e a tua lista começa vazia
- [x] Navegação: separadores no telemóvel, menu lateral no PC; tema claro/escuro/sistema
- [x] `ExerciseRepository` completo (pesquisa, filtros, guardar, arquivar, restaurar, remover), adiantado da Fase 1.1
- [x] Biblioteca de 414 exercícios (376 força, 14 mobilidade, 24 cardio) (Exercícios → Biblioteca), adiciona com um toque (ver `docs/biblioteca.md`)
- [x] Fase 1.1: criar, editar, arquivar, restaurar e apagar exercícios; filtros completos e ordenação
- [x] Tipo Cardio (migração 002): duração, com distância e calorias opcionais por série
- [x] Fase 1.2: treinos com dois blocos, Aquecimento e Principal (mobilidade livre em qualquer um); criar, editar, copiar, arquivar, apagar, reordenar e alvos por exercício
- [x] Fase 1.3: sessão ativa (a partir de um treino ou livre), séries com carga, reps, duração, lados e amplitude, pré-preenchimento, descanso real, cronómetro de duração e bolha do temporizador com som e vibração; terminar com esforço e notas
- [x] Fase 1.4: histórico por sessão e por exercício com correções; exportar/importar JSON com merge «última escrita ganha» (`core/merge`), lembrete de cópia de segurança e proposta de fim para sessões esquecidas
- [x] Fase 1.5: Home com próximo treino, séries da semana por músculo e mobilidade da semana; Planeados; Perfil com medições e IMC; onboarding; ecrã de configurar o relógio; notificação local no fim do temporizador (Android)
- [x] 151 testes em Node (migrações, restrições, seed, definições, transações, repositórios, biblioteca, treinos, servidor Postgres)
- [x] PWA: instalável no telemóvel, abre offline e avisa quando há versão nova
- [x] Fase 2 (servidor): `supabase/migrations` com o esquema Postgres, RLS por utilizador e as funções `sync_push`, `sync_pull` e `delete_my_data`, testadas num Postgres real (PGlite)
- [x] Fase 2 (app): conta opcional com Supabase Auth (Definições → Conta): entrar, criar conta, sair, apagar dados na nuvem
- [x] Fase 2: SQL aplicado no projeto Supabase (ver «Servidor» abaixo); login obrigatório
- [x] Fase 3: sync automático (`core/sync`): envia o que mudou, traz o que mudou, última escrita ganha; estado em Definições → Conta; testado contra um Postgres real com vários dispositivos simulados
- [ ] Fase 3: testar com o PC e o telemóvel reais
- [x] Fase 4.1: ecrã Gráficos (séries de força e minutos de mobilidade por semana, peso corporal, progressão do 1RM por exercício)
- [ ] APK testado num Android real (falta correr no teu PC, ver abaixo)

## Requisitos

- Node 20.19+ ou 22.12+
- Para Android: Android Studio (traz o SDK e o JDK)

## Comandos (pasta `app/`)

```bash
npm install            # também copia o sql-wasm.wasm para public/assets (postinstall)
npm start              # app no browser em http://localhost:4200
npm run test:core      # testes da camada de dados em Node
npm run build          # build web para www/
```

### Versão web publicada (GitHub Pages)

Cada push para `main` corre os testes e publica em `https://ruimarques13.github.io/gym-tracker/`
(workflow `.github/workflows/deploy-web.yml`). Os dados ficam no browser de quem abre; até haver sync
(Fase 3), o PC e o telemóvel têm bases separadas.

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
node build-seed.mjs                                           # gera app/src/app/core/seed/seed.generated.ts
```

O seed só insere linhas novas: nunca sobrepõe exercícios que editaste, arquivaste ou apagaste.

## Estrutura

```
app/src/app/
  core/db/            DbAdapter, adaptadores, migrações, migrator, local_meta
  core/settings/      registo de definições, SettingsStore (sem Angular), SettingsService
  core/seed/          seed gerado + loader
  core/library/       biblioteca gerada + conversão para exercício
  core/theme/         tema claro/escuro
  core/navigation/    lista única de ecrãs (menu, separadores, «Mais»)
  data/models/        tipos de domínio
  data/repositories/  interfaces + implementações SQLite + tokens de injeção
  features/           ecrãs
tools/import-excel/   catalog.json, importador do Excel, gerador do seed
tools/exercise-library/ catálogo da biblioteca (.md) e conversor
docs/                 notas técnicas
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
