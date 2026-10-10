# Gym Tracker

App pessoal para planear e registar treinos de força e mobilidade. Local primeiro (SQLite no
dispositivo), Android e browser no PC, sync na Fase 3. Requisitos e fases: documento
«Gym Tracker — requisitos, arquitetura e fases» (v2) no projeto.

## Estado: Fase 0 (fundações)

- [x] Projeto Ionic 9 + Angular 21 (standalone, sem zone.js) + Capacitor 8, alvos web e Android
- [x] `DbAdapter` com três implementações: SQLite nativo (Android), jeep-sqlite (browser), sql.js (testes)
- [x] Migrações versionadas, cada uma numa transação (`001-init`: todas as tabelas da secção 6, com campos de sync)
- [x] `device_id` persistido, relógio injetável, UUID v4/v5
- [x] Registo central de definições + `SettingsService` (signals), três âmbitos
- [x] Catálogo editável + importador do Excel + seed (25 força, 14 mobilidade) com IDs determinísticos
- [x] Navegação: separadores no telemóvel, menu lateral no PC; tema claro/escuro/sistema
- [x] `ExerciseRepository` completo (pesquisa, filtros, guardar, arquivar, restaurar, remover), adiantado da Fase 1.1
- [x] Biblioteca de 376 exercícios (Exercícios → Biblioteca), adiciona com um toque (ver `docs/biblioteca.md`)
- [x] 45 testes em Node (migrações, restrições, seed, definições, transações, repositório, biblioteca)
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
- **Migrações em TypeScript** (`001-init.ts`) em vez de `.sql`, para o mesmo ficheiro servir o build e os testes sem configuração extra.
- IDs determinísticos: ver `docs/ids.md`.
