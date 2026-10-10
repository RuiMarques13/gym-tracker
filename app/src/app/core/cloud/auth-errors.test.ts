import { describe, expect, it } from 'vitest';
import { translateAuthError } from './auth-errors';
import { sessionStorageKey } from './cloud-config';

describe('translateAuthError', () => {
  it('traduz os códigos conhecidos', () => {
    expect(translateAuthError({ code: 'invalid_credentials' })).toMatch(/errados/);
    expect(translateAuthError({ code: 'email_not_confirmed' })).toMatch(/confirmar o email/);
    expect(translateAuthError({ code: 'user_already_exists' })).toMatch(/Já existe/);
    expect(translateAuthError({ code: 'weak_password' })).toMatch(/8 caracteres/);
    expect(translateAuthError({ code: 'over_request_rate_limit' })).toMatch(/Demasiadas/);
  });
  it('reconhece falta de rede', () => {
    expect(translateAuthError({ name: 'AuthRetryableFetchError', message: 'x' })).toMatch(/Sem ligação/);
    expect(translateAuthError({ message: 'Failed to fetch' })).toMatch(/Sem ligação/);
  });
  it('tem mensagem por defeito e nunca mostra texto técnico', () => {
    expect(translateAuthError({ message: 'pg_catalog exploded' })).toBe('Não foi possível concluir. Tenta outra vez.');
    expect(translateAuthError(null)).toMatch(/Tenta outra vez/);
  });
});

describe('sessionStorageKey', () => {
  it('usa a referência do projeto, como o supabase-js', () => {
    expect(sessionStorageKey('https://abcdef.supabase.co')).toBe('sb-abcdef-auth-token');
  });
});
