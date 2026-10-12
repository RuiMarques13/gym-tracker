/** Texto dos avisos: sem dependências do Ionic, para se poder testar à parte. */
const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapa o texto e põe a negrito o que vem entre «», por exemplo «Supino» criado. → <b>Supino</b> criado. */
export function toastHtml(message: string): string {
  return escapeHtml(message).replace(/«(.+?)»/g, '<b>$1</b>');
}
