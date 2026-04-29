import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface HostNotification {
  id: string;
  hebergeurId: number;
  type: 'modification' | 'suppression' | 'reclamation';
  logementNom: string;
  message: string;
  reason?: string;
  reclamationId?: string;
  date: string;
  read: boolean;
  source: 'local'; // Ajout de la propriété source pour compatibilité
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly storageKey = 'hosthub_notifications';

  /** Observable that emits every time the notifications list changes. */
  private readonly _notifications$ = new BehaviorSubject<HostNotification[]>(this.getAll());
  readonly notifications$ = this._notifications$.asObservable();

  /* ─── Write ─── */

  addNotification(
    hebergeurId: number,
    type: 'modification' | 'suppression' | 'reclamation',
    logementNom: string,
    message: string,
    reason?: string,
    metadata?: { reclamationId?: string }
  ): void {
    const all = this.getAll();
    const notif: HostNotification = {
      id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      hebergeurId,
      type,
      logementNom,
      message,
      reason,
      reclamationId: metadata?.reclamationId,
      date: new Date().toISOString(),
      read: false,
      source: 'local' // Initialisation de la propriété source
    };
    all.unshift(notif);
    this.persist(all);
  }

  markAsRead(notifId: string): void {
    const all = this.getAll();
    const n = all.find((x) => x.id === notifId);
    if (n) {
      n.read = true;
      this.persist(all);
    }
  }

  markAllAsRead(hebergeurId: number): void {
    const all = this.getAll();
    all.filter((n) => n.hebergeurId === hebergeurId).forEach((n) => (n.read = true));
    this.persist(all);
  }

  deleteNotification(notifId: string): void {
    let all = this.getAll();
    all = all.filter((n) => n.id !== notifId);
    this.persist(all);
  }

  clearAll(hebergeurId: number): void {
    let all = this.getAll();
    all = all.filter((n) => n.hebergeurId !== hebergeurId);
    this.persist(all);
  }

  /* ─── Read ─── */

  getForHebergeur(hebergeurId: number): HostNotification[] {
    return this.getAll().filter((n) => n.hebergeurId === hebergeurId);
  }

  getUnreadCount(hebergeurId: number): number {
    return this.getForHebergeur(hebergeurId).filter((n) => !n.read).length;
  }

  /* ─── Internals ─── */

  private getAll(): HostNotification[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persist(all: HostNotification[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(all));
    this._notifications$.next(all);
  }
}
