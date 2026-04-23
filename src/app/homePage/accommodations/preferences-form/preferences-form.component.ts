import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';

export interface UserPrefs {
  purposeVoyage: string | null;
  budgetMax: number | null;
  villePreferee: string | null;
  capaciteMin: number | null;
  equipementsImportants: string[];
}

@Component({
  selector: 'app-preferences-form',
  templateUrl: './preferences-form.component.html',
  styleUrls: ['./preferences-form.component.css']
})
export class PreferencesFormComponent implements OnChanges {
  @Input() visible = false;
  @Input() availableVilles: string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<UserPrefs>();

  step = 1;
  totalSteps = 5;

  prefs: UserPrefs = {
    purposeVoyage: null,
    budgetMax: null,
    villePreferee: null,
    capaciteMin: null,
    equipementsImportants: []
  };

  purposeOptions = [
    { value: 'famille',      label: 'Vacances famille',        icon: '👨‍👩‍👧‍👦' },
    { value: 'romantique',   label: 'Escapade romantique',     icon: '💑' },
    { value: 'amis',         label: 'Séjour entre amis',       icon: '🎉' },
    { value: 'solo',         label: 'Voyage solo',             icon: '🧳' },
    { value: 'lune_de_miel', label: 'Lune de miel',            icon: '💍' },
    { value: 'business',     label: 'Voyage professionnel',    icon: '💼' }
  ];

  budgetOptions = [
    { label: 'Moins de 100 DT',   value: 100 },
    { label: '100 – 200 DT',      value: 200 },
    { label: '200 – 350 DT',      value: 350 },
    { label: '350 – 500 DT',      value: 500 },
    { label: '500 – 800 DT',      value: 800 },
    { label: 'Pas de limite',     value: 9999 }
  ];

  villeOptions: string[] = [];

  ngOnChanges(): void {
    // Synchronise villeOptions à chaque fois qu'availableVilles change
    this.villeOptions = this.availableVilles;
  }

  groupSizes = [
    { label: '1',    value: 1 },
    { label: '2',    value: 2 },
    { label: '3–4',  value: 3 },
    { label: '5–6',  value: 5 },
    { label: '7+',   value: 7 }
  ];

  equipementsOptions = [
    { label: '🏊 Piscine',          value: 'Piscine' },
    { label: '🌊 Vue mer',           value: 'Vue mer' },
    { label: '📶 Wi-Fi',             value: 'WiFi' },
    { label: '🍳 Cuisine équipée',   value: 'Cuisine' },
    { label: '🚗 Parking',           value: 'Parking' },
    { label: '❄️ Climatisation',     value: 'Climatisation' },
    { label: '🛁 Jacuzzi',           value: 'Jacuzzi' },
    { label: '🌳 Jardin privé',      value: 'Jardin' },
    { label: '🍽️ Petit-déjeuner',    value: 'Petit-dejeuner' },
    { label: '🏋️ Salle de sport',    value: 'Sport' }
  ];

  toggleEquipement(val: string): void {
    const idx = this.prefs.equipementsImportants.indexOf(val);
    if (idx === -1) this.prefs.equipementsImportants.push(val);
    else this.prefs.equipementsImportants.splice(idx, 1);
  }

  isSelected(val: string): boolean {
    return this.prefs.equipementsImportants.includes(val);
  }

  next(): void { if (this.step < this.totalSteps) this.step++; }
  back(): void { if (this.step > 1) this.step--; }

  submit(): void {
    this.saved.emit({ ...this.prefs, equipementsImportants: [...this.prefs.equipementsImportants] });
    this.closed.emit();
    this.step = 1;
  }

  close(): void {
    this.closed.emit();
    this.step = 1;
  }

  get progressWidth(): string {
    return `${(this.step / this.totalSteps) * 100}%`;
  }

  get stepLabel(): { emoji: string; title: string; subtitle: string } {
    const steps = [
      { emoji: '✈️', title: 'Quel est le but de votre voyage ?',        subtitle: 'Choisissez ce qui correspond le mieux à votre séjour' },
      { emoji: '💰', title: 'Quel est votre budget par nuit ?',          subtitle: 'En dinars tunisiens (DT) — taxes incluses' },
      { emoji: '📍', title: 'Quelle destination vous attire ?',          subtitle: 'Choisissez la région idéale pour votre séjour' },
      { emoji: '👥', title: 'Combien serez-vous ?',                      subtitle: 'Nombre de personnes pour le séjour' },
      { emoji: '⭐', title: 'Quels services sont essentiels ?',           subtitle: 'Sélectionnez tout ce qui compte pour vous' }
    ];
    return steps[this.step - 1];
  }
}
