export interface AuthLikeError {
  code?: string;
  message?: string;
  status?: number;
  name?: string;
}

/** Mensagens em português para os erros do Supabase Auth. */
export function translateAuthError(err: AuthLikeError | null | undefined): string {
  if (!err) return 'Algo correu mal. Tenta outra vez.';
  const msg = (err.message ?? '').toLowerCase();
  switch (err.code) {
    case 'invalid_credentials':
      return 'Email ou palavra-passe errados.';
    case 'email_not_confirmed':
      return 'Falta confirmar o email. Abre a mensagem que te enviámos e carrega no link.';
    case 'user_already_exists':
    case 'email_exists':
      return 'Já existe uma conta com este email. Usa «Entrar».';
    case 'weak_password':
      return 'Palavra-passe fraca. Usa pelo menos 8 caracteres.';
    case 'signup_disabled':
    case 'email_provider_disabled':
      return 'Criar contas está desligado neste projeto.';
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiadas tentativas. Espera um pouco e tenta outra vez.';
    case 'validation_failed':
      return 'Email ou palavra-passe inválidos.';
  }
  if (err.name === 'AuthRetryableFetchError' || err.status === 0 || msg.includes('failed to fetch') || msg.includes('network')) {
    return 'Sem ligação à internet. Tenta outra vez quando tiveres rede.';
  }
  if (msg.includes('invalid login')) return 'Email ou palavra-passe errados.';
  return 'Não foi possível concluir. Tenta outra vez.';
}
