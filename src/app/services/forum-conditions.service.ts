import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ForumConditionsService {

  private readonly STORAGE_KEY = 'forum_conditions_accepted';

  // Clé unique par utilisateur
  private getKey(): string {
    try {
      const user = JSON.parse(localStorage.getItem('current_user') || 'null');
      const userId = user?.id ?? 'anonymous';
      return `${this.STORAGE_KEY}_${userId}`;
    } catch {
      return `${this.STORAGE_KEY}_anonymous`;
    }
  }

  private cleanStorage(): void {
    try {
      const data = localStorage.getItem(this.getKey());
      if (!data) return;
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) {
        localStorage.setItem(this.getKey(), '[]');
        return;
      }
      // ✅ Accepter aussi les strings pour éviter les pertes silencieuses
      const clean = parsed
        .map((id: any) => Number(id))
        .filter((id: number) => !isNaN(id));
      localStorage.setItem(this.getKey(), JSON.stringify(clean));
    } catch {
      localStorage.setItem(this.getKey(), '[]');
    }
  }

  private getAccepted(): number[] {
    try {
      const data = localStorage.getItem(this.getKey());
      if (!data) return [];
      const parsed = JSON.parse(data);
      if (!Array.isArray(parsed)) return [];
      // ✅ Convertir en number pour éviter le bug string vs number
      return parsed.map((id: any) => Number(id)).filter((id) => !isNaN(id));
    } catch {
      return [];
    }
  }

  hasAccepted(communityId: number): boolean {
    return this.getAccepted().includes(Number(communityId));
  }

  markAsAccepted(communityId: number): void {
    const accepted = this.getAccepted();
    const id = Number(communityId);
    if (!accepted.includes(id)) {
      accepted.push(id);
      localStorage.setItem(this.getKey(), JSON.stringify(accepted));
    }
  }

  reset(communityId: number): void {
    const accepted = this.getAccepted().filter(id => id !== Number(communityId));
    localStorage.setItem(this.getKey(), JSON.stringify(accepted));
  }

  // ✅ Utile pour réinitialiser à la déconnexion
  resetAll(): void {
    localStorage.removeItem(this.getKey());
  }
}