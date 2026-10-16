import { computed, inject, Injectable, resource } from '@angular/core';
import { BODY_METRIC_REPOSITORY } from '../repositories';
import { SettingsService } from '../settings/settings.service';
import { CLOCK } from '../clock';
import { ageOn } from '../../core/util/body';
import { toLocalDate } from '../../core/util/week';
import type { BodyProfile } from '../../core/health/calories';

/** Perfil corporal para as estimativas de calorias: peso mais recente, altura, idade e sexo. */
@Injectable({ providedIn: 'root' })
export class BodyProfileService {
  private readonly settings = inject(SettingsService);
  private readonly bodyRepo = inject(BODY_METRIC_REPOSITORY);
  private readonly clock = inject(CLOCK);
  private readonly birth = this.settings.get('profileBirthDate');
  private readonly sex = this.settings.get('profileSex');
  private readonly height = this.settings.get('profileHeightCm');
  private readonly weight = resource({ loader: () => this.bodyRepo.list('WEIGHT_KG', 1) });

  readonly profile = computed<BodyProfile>(() => ({
    weightKg: this.weight.value()?.[0]?.value ?? null,
    heightCm: this.height(),
    age: ageOn(this.birth(), toLocalDate(this.clock.now())),
    sex: this.sex(),
  }));

  /** Falta algum dado para a estimativa por FC (o peso é o essencial). */
  readonly missing = computed(() => {
    const p = this.profile();
    const out: string[] = [];
    if (!p.weightKg) out.push('peso');
    if (!p.age) out.push('data de nascimento');
    if (!p.sex) out.push('sexo');
    return out;
  });

  reload(): void {
    this.weight.reload();
  }
}
