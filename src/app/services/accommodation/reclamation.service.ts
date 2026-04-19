import { Injectable, inject } from '@angular/core';
import { NotificationService } from './notification.service';

export type ReclamationStatus = 'ouverte' | 'en_cours' | 'resolue';
export type ReclamationActorRole = 'CLIENT_TOURISTE' | 'HEBERGEUR' | 'ADMIN';

export interface ReclamationImage {
  name: string;
  dataUrl: string;
}

export interface ReclamationReply {
  id: string;
  authorId: number;
  authorName: string;
  authorRole: ReclamationActorRole;
  message: string;
  createdAt: string;
  seenByClient?: boolean;
}

export interface ReclamationItem {
  id: string;
  clientId: number;
  clientName: string;
  clientEmail?: string;
  reservationId: number;
  logementId: number;
  logementNom: string;
  hebergeurId: number;
  title: string;
  description: string;
  imageCount: number;
  imagePreviews?: string[];
  status: ReclamationStatus;
  createdAt: string;
  updatedAt: string;
  replies: ReclamationReply[];
}

export interface CreateReclamationPayload {
  clientId: number;
  clientName: string;
  clientEmail?: string;
  reservationId: number;
  logementId: number;
  logementNom: string;
  hebergeurId: number;
  title: string;
  description: string;
  images: ReclamationImage[];
}

@Injectable({ providedIn: 'root' })
export class ReclamationService {
  private readonly storageKey = 'tunisiatour_reclamations';
  private readonly maxStoredItems = 500; // Limite le stockage local à 500 items
  private readonly archiveDaysThreshold = 90; // Archive les items > 90 jours
  private readonly adminRecipientId = 0; // Canal admin global (local)
  private readonly notificationService = inject(NotificationService);

  getAll(): ReclamationItem[] {
    return this.getAllInternal();
  }

  getByClient(clientId: number): ReclamationItem[] {
    return this.getAllInternal().filter((r) => r.clientId === clientId);
  }

  getByHebergeur(hebergeurId: number): ReclamationItem[] {
    return this.getAllInternal().filter((r) => r.hebergeurId === hebergeurId);
  }

  getClientUnreadReplyCount(clientId: number): number {
    return this.getByClient(clientId).reduce((acc, item) => {
      const unread = item.replies.filter(
        (reply) => (reply.authorRole === 'ADMIN' || reply.authorRole === 'HEBERGEUR') && !reply.seenByClient
      ).length;
      return acc + unread;
    }, 0);
  }

  markClientRepliesAsSeen(clientId: number): void {
    const all = this.getAllInternal();
    let changed = false;

    all.forEach((item) => {
      if (item.clientId !== clientId) return;
      item.replies.forEach((reply) => {
        const isStaff = reply.authorRole === 'ADMIN' || reply.authorRole === 'HEBERGEUR';
        if (isStaff && !reply.seenByClient) {
          reply.seenByClient = true;
          changed = true;
        }
      });
    });

    if (changed) {
      this.cleanupStorage(all);
      this.persist(all);
    }
  }

  getById(reclamationId: string): ReclamationItem | null {
    return this.getAllInternal().find((r) => r.id === reclamationId) ?? null;
  }

  getBlockingReclamationForClient(clientId: number): ReclamationItem | null {
    const byClient = this.getByClient(clientId);
    const blocking = byClient.find((item) => !this.hasStaffReply(item));
    return blocking ?? null;
  }

  canClientCreateReclamation(clientId: number): boolean {
    return !this.getBlockingReclamationForClient(clientId);
  }

  createReclamation(payload: CreateReclamationPayload): ReclamationItem {
    const blocking = this.getBlockingReclamationForClient(payload.clientId);
    if (blocking) {
      throw new Error('Une reclamation est deja en attente de reponse de l\'Equipe TunisiaTour.');
    }

    const all = this.getAllInternal();
    const now = new Date().toISOString();
    const item: ReclamationItem = {
      id: this.uuid(),
      clientId: payload.clientId,
      clientName: payload.clientName,
      clientEmail: payload.clientEmail,
      reservationId: payload.reservationId,
      logementId: payload.logementId,
      logementNom: payload.logementNom,
      hebergeurId: payload.hebergeurId,
      title: payload.title.trim(),
      description: payload.description.trim(),
      imageCount: payload.images.length,
      imagePreviews: payload.images.slice(0, 3).map((img) => img.dataUrl),
      status: 'ouverte',
      createdAt: now,
      updatedAt: now,
      replies: []
    };

    all.unshift(item);
    
    // Nettoyage avant persistance
    this.cleanupStorage(all);
    this.persist(all);

    // Notification hebergeur
    this.notificationService.addNotification(
      item.hebergeurId,
      'reclamation',
      item.logementNom,
      `Nouvelle réclamation client: ${item.title}`,
      item.description,
      { reclamationId: item.id }
    );

    // Notification admin
    this.notificationService.addNotification(
      this.adminRecipientId,
      'reclamation',
      item.logementNom,
      `Nouvelle réclamation à traiter: ${item.title}`,
      `Client: ${item.clientName}`,
      { reclamationId: item.id }
    );

    return item;
  }

  addReply(
    reclamationId: string,
    authorId: number,
    authorName: string,
    authorRole: ReclamationActorRole,
    message: string
  ): ReclamationItem | null {
    const all = this.getAllInternal();
    const item = all.find((r) => r.id === reclamationId);
    if (!item) return null;

    const reply: ReclamationReply = {
      id: this.uuid(),
      authorId,
      authorName,
      authorRole,
      message: message.trim(),
      createdAt: new Date().toISOString(),
      seenByClient: authorRole === 'CLIENT_TOURISTE'
    };

    item.replies.push(reply);
    item.updatedAt = new Date().toISOString();
    if (item.status === 'ouverte') {
      item.status = 'en_cours';
    }

    // Nettoyage avant persistance
    this.cleanupStorage(all);
    this.persist(all);

    // Toute reponse admin/hebergeur est notifiee au client
    if (authorRole === 'ADMIN' || authorRole === 'HEBERGEUR') {
      this.notificationService.addNotification(
        item.clientId,
        'reclamation',
        item.logementNom,
        `Nouvelle réponse sur votre réclamation: ${item.title}`,
        message.trim(),
        { reclamationId: item.id }
      );
    }

    // Si admin repond, l'hebergeur est aussi notifie
    if (authorRole === 'ADMIN') {
      this.notificationService.addNotification(
        item.hebergeurId,
        'reclamation',
        item.logementNom,
        `Réponse admin sur réclamation: ${item.title}`,
        message.trim(),
        { reclamationId: item.id }
      );
    }

    return item;
  }

  updateStatus(reclamationId: string, status: ReclamationStatus): ReclamationItem | null {
    const all = this.getAllInternal();
    const item = all.find((r) => r.id === reclamationId);
    if (!item) return null;
    item.status = status;
    item.updatedAt = new Date().toISOString();
    
    // Nettoyage avant persistance
    this.cleanupStorage(all);
    this.persist(all);
    return item;
  }

  private getAllInternal(): ReclamationItem[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      const parsed: any[] = raw ? JSON.parse(raw) : [];
      const normalized = Array.isArray(parsed)
        ? parsed.map((item) => this.normalizeItem(item))
        : [];

      return Array.isArray(normalized)
        ? normalized.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        : [];
    } catch (error) {
      console.warn('Error parsing reclamations from storage:', error);
      // Si le stockage est corrompu, on le réinitialise
      try {
        localStorage.removeItem(this.storageKey);
      } catch (e) {
        // Silencieusement ignorer les erreurs de localStorage
      }
      return [];
    }
  }

  /**
   * Nettoyage automatique du stockage:
   * 1. Supprime les items archivés (> 90 jours)
   * 2. Limite le nombre total à 500 items max
   * 3. Conserve les items résolus mais récents
   */
  private cleanupStorage(all: ReclamationItem[]): void {
    const now = new Date();
    const archiveThreshold = new Date(now.getTime() - this.archiveDaysThreshold * 24 * 60 * 60 * 1000);

    // Étape 1: Supprimer les items très anciens (> archiveDaysThreshold)
    let filtered = all.filter((item) => new Date(item.updatedAt) > archiveThreshold);

    // Étape 2: Si encore trop d'items, supprimer les plus anciens résolus en priorité
    if (filtered.length > this.maxStoredItems) {
      const resolved = filtered.filter((item) => item.status === 'resolue').sort((a, b) => 
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      const notResolved = filtered.filter((item) => item.status !== 'resolue');

      const itemsToRemove = filtered.length - this.maxStoredItems;
      const resolvedToRemove = Math.min(itemsToRemove, resolved.length);

      // Supprimer les items résolus anciens
      const removedIds = new Set(resolved.slice(0, resolvedToRemove).map((item) => item.id));

      // Si on a encore besoin de supprimer, on supprime les plus anciens résolus
      if (removedIds.size < itemsToRemove) {
        const additionalNeeded = itemsToRemove - removedIds.size;
        const moreToRemove = resolved.slice(resolvedToRemove).slice(0, additionalNeeded);
        moreToRemove.forEach((item) => removedIds.add(item.id));
      }

      filtered = filtered.filter((item) => !removedIds.has(item.id));
    }

    // Mettre à jour l'array original
    all.length = 0;
    all.push(...filtered);
  }

  private persist(all: ReclamationItem[]): void {
    try {
      const json = JSON.stringify(all);
      localStorage.setItem(this.storageKey, json);
    } catch (error) {
      if (error instanceof Error && error.message.includes('QuotaExceededError')) {
        console.error('LocalStorage quota exceeded. Attempting preview cleanup...');

        // Etape 1: on enlève seulement les aperçus images, on garde les données métiers.
        const withoutPreviews = all.map((item) => ({
          ...item,
          imagePreviews: []
        }));

        try {
          localStorage.setItem(this.storageKey, JSON.stringify(withoutPreviews));
          all.length = 0;
          all.push(...withoutPreviews);
          console.log('Storage recovered by removing image previews.');
          return;
        } catch {
          // Continue with aggressive cleanup if still failing.
        }

        console.error('Preview cleanup failed. Attempting aggressive cleanup...');
        // Nettoyage agressif: garder seulement les 100 derniers items
        const aggressive = all.slice(0, 100);
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(aggressive));
          console.log('Aggressive cleanup successful. Kept 100 most recent items.');
        } catch (e) {
          // Si même ça échoue, clear tout et recommencer
          try {
            localStorage.removeItem(this.storageKey);
            localStorage.setItem(this.storageKey, JSON.stringify(aggressive));
            console.log('Full reset and recovery successful.');
          } catch (final) {
            console.error('Fatal: Unable to persist reclamations. LocalStorage may be unavailable.', final);
          }
        }
      } else {
        console.error('Error persisting reclamations:', error);
      }
    }
  }

  private hasStaffReply(item: ReclamationItem): boolean {
    return item.replies.some((reply) => reply.authorRole === 'ADMIN' || reply.authorRole === 'HEBERGEUR');
  }

  private normalizeItem(item: any): ReclamationItem {
    const legacyImages = Array.isArray(item?.images) ? item.images : [];
    const legacyPreviews = legacyImages
      .map((img: any) => String(img?.dataUrl || ''))
      .filter((url: string) => !!url)
      .slice(0, 3);

    const imagePreviews = Array.isArray(item?.imagePreviews)
      ? item.imagePreviews.filter((x: unknown) => typeof x === 'string').slice(0, 3)
      : legacyPreviews;

    const imageCount = typeof item?.imageCount === 'number'
      ? item.imageCount
      : (imagePreviews.length || legacyImages.length || 0);

    const clientEmail = typeof item?.clientEmail === 'string'
      ? item.clientEmail
      : (typeof item?.clientName === 'string' && item.clientName.includes('@') ? item.clientName : undefined);

    return {
      ...item,
      clientEmail,
      imageCount,
      imagePreviews,
      replies: Array.isArray(item?.replies)
        ? item.replies.map((reply: any) => {
            const isStaff = reply?.authorRole === 'ADMIN' || reply?.authorRole === 'HEBERGEUR';
            return {
              ...reply,
              seenByClient: typeof reply?.seenByClient === 'boolean' ? reply.seenByClient : !isStaff
            };
          })
        : []
    } as ReclamationItem;
  }

  private uuid(): string {
    return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
}
