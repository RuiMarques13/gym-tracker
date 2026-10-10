// O jeep-sqlite (browser) traz embutido o JavaScript do sql.js 1.11.0 e pede assets/sql-wasm.wasm.
// O .wasm tem de ser exatamente dessa versão, por isso o sql.js está fixado em 1.11.0 no package.json.
// Ao atualizar o jeep-sqlite, confirmar a versão do sql.js que ele embute e acertar as duas.
// Corre sozinho depois de "npm install" (postinstall).
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
const EXPECTED = '1.11.0';
const pkg = JSON.parse(readFileSync('node_modules/sql.js/package.json', 'utf8'));
if (pkg.version !== EXPECTED) {
  console.error(`sql.js instalado é ${pkg.version}, mas o jeep-sqlite precisa de ${EXPECTED}. A app web não vai abrir a base.`);
  process.exit(1);
}
mkdirSync('public/assets', { recursive: true });
copyFileSync('node_modules/sql.js/dist/sql-wasm.wasm', 'public/assets/sql-wasm.wasm');
console.log(`sql-wasm.wasm ${EXPECTED} copiado para public/assets/`);
