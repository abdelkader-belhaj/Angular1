import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ForumConditionsService {

  private readonly STORAGE_KEY = 'forum_conditions_accepted';

  constructor() {
    // Nettoie les données corrompues au démarrage
    this.cleanStorage();
  }

  private cleanStorage(): void {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return;
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(this.STORAGE_KEY, '[]');
        return;
      }
      const clean = parsed.filter((id: any) => typeof id === 'number');
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(clean));
    } catch {
      localStorage.setItem(this.STORAGE_KEY, '[]');
    }
  }

  private getAccepted(): number[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id: any) => typeof id === 'number');
    } catch {
      return [];
    }
  }

  hasAccepted(communityId: number): boolean {
    return this.getAccepted().includes(communityId);
  }

  markAsAccepted(communityId: number): void {
    const accepted = this.getAccepted();
    if (!accepted.includes(communityId)) {
      accepted.push(communityId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accepted));
    }
  }

  reset(communityId: number): void {
    const accepted = this.getAccepted().filter(id => id !== communityId);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(accepted));
  }
}