import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PanierItem, PanierRequest } from '../models/panier.model';
import { Vol } from '../models/vol.model';

@Injectable({ providedIn: 'root' })
export class PanierService {

  private items$ = new BehaviorSubject<PanierItem[]>([]);

  constructor() {
    this.items$.next(this.load());
  }

  // ── Clé unique par utilisateur ──────────────────────────────
  private getKey(): string {
    try {
      const user = JSON.parse(localStorage.getItem('auth_user') ?? '{}');
      return `panier_${user?.id ?? 'guest'}`;
    } catch { return 'panier_guest'; }
  }

  // ── Vider le panier quand on change d'utilisateur ──────────
  recharger(): void {
    this.items$.next(this.load());
  }

  get items(): PanierItem[] {
    return this.items$.getValue();
  }

  get panierItems$() {
    return this.items$.asObservable();
  }

  ajouter(volAller: Vol, req: PanierRequest, volRetour?: Vol): void {
    const item: PanierItem = {
      id: Date.now(),
      volAller,
      volRetour: volRetour ?? null,
      typeBillet: req.typeBillet,
      nbPassagers: req.nbPassagers,
      prixTotal: this.calculerPrix(volAller, req.nbPassagers, volRetour),
      dateAjout: new Date().toISOString()
    };
    const updated = [...this.items, item];
    this.save(updated);
    this.items$.next(updated);
  }

  supprimer(id: number): void {
    const updated = this.items.filter(i => i.id !== id);
    this.save(updated);
    this.items$.next(updated);
  }

  vider(): void {
    this.save([]);
    this.items$.next([]);
  }

  private calculerPrix(volAller: Vol, nb: number, volRetour?: Vol): number {
    let total = 0;
    
    const p1 = volAller.offre ? volAller.prix * (1 - volAller.offre!.pourcentage/100) : volAller.prix;
    total += p1 * nb;
    
    if (volRetour) {
      const p2 = volRetour.offre ? volRetour.prix * (1 - volRetour.offre!.pourcentage/100) : volRetour.prix;
      total += p2 * nb;
    }
    
    return total;
  }

  private load(): PanierItem[] {
    try {
      return JSON.parse(localStorage.getItem(this.getKey()) ?? '[]');
    } catch { return []; }
  }

  private save(items: PanierItem[]): void {
    localStorage.setItem(this.getKey(), JSON.stringify(items));
  }
}