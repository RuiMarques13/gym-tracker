# IDs determinísticos

Linhas que dois dispositivos podem criar de forma independente usam **UUID v5** com o namespace fixo
`APP_NAMESPACE` (`app/src/app/core/util/uuid.ts`). Nunca mudar o namespace nem o formato das chaves:
mudar qualquer um gera IDs novos e duplica dados no sync.

| Entidade | Chave |
| --- | --- |
| exercise (seed) | `exercise:<nome>` |
| equipment | `equipment:<key>` |
| muscle_group | `muscle:<key>` |
| mobility_area | `mobility_area:<key>` |
| exercise_muscle | `exercise_muscle:<exercise_id>:<muscle_group_id>` |
| exercise_mobility_area | `exercise_mobility_area:<exercise_id>:<mobility_area_id>` |
| setting | `setting:<scope>:<scope_ref>:<key>` |

Linhas criadas pelo utilizador (treinos, sessões, séries, exercícios novos) usam UUID v4.

As linhas de seed têm `updated_at = 2000-01-01T00:00:00.000Z`, para qualquer edição feita por ti
ganhar sempre no last-write-wins, mesmo que outro dispositivo faça o seed mais tarde.
