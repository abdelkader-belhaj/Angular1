import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Subscription } from 'rxjs';
import { NotificationService, HostNotification } from '../../services/accommodation/notification.service';
import { AuthService } from '../../services/auth.service';
import { NotificationClientService, BackendNotification } from '../../services/accommodation/notification-client.service';
import { ReclamationService, ReclamationItem } from '../../services/accommodation/reclamation.service';
import { Router } from '@angular/router';

type NotificationViewFilter = 'all' | 'important' | 'archived';
type NotificationGroupKey = 'reservation' | 'message' | 'admin_action' | 'payment';

interface UnifiedNotificationItem {
  id: string;
  source: 'local' | 'backend';
  kind: NotificationGroupKey;
  title: string;
  message: string;
  date: string;
  read: boolean;
  archived: boolean;
  important: boolean;
  accent: 'teal' | 'cyan' | 'amber' | 'emerald' | 'slate';
  reason?: string;
  reclamationId?: string;
  rawLocal?: HostNotification;
  rawBackend?: BackendNotification;
}

interface NotificationGroup {
  key: NotificationGroupKey;
  label: string;
  icon: string;
  items: UnifiedNotificationItem[];
}

@Component({
  selector: 'app-hebergeur-notifications',
  templateUrl: './hebergeur-notifications.component.html',
  styleUrl: './hebergeur-notifications.component.css'
})
export class HebergeurNotificationsComponent implements OnInit, OnDestroy {
  private readonly notificationService = inject(NotificationService);
  private readonly notificationClientService = inject(NotificationClientService);
  private readonly reclamationService = inject(ReclamationService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private sub!: Subscription;

  notifications: HostNotification[] = [];
  backendNotifs: BackendNotification[] = [];
  viewFilter: NotificationViewFilter = 'all';
  openedReclamationId: string | null = null;
  openedReclamation: ReclamationItem | null = null;
  replyingReclamationId: string | null = null;
  replyDrafts: Record<string, string> = {};

  private readonly archivedLocalStorageKey = 'hosthub_notifications_archived';
  private readonly archivedBackendStorageKey = 'hosthub_backend_notifications_archived';
  private readonly localArchivedIds = new Set<string>(this.loadStringArray(this.archivedLocalStorageKey));
  private readonly backendArchivedIds = new Set<number>(this.loadNumberArray(this.archivedBackendStorageKey));

  get hebergeurId(): number {
    return this.authService.getCurrentUser()?.id ?? 0;
  }

  get unreadCount(): number {
    return this.getAllItems().filter((item) => !item.read && !item.archived).length;
  }

  get visibleGroups(): NotificationGroup[] {
    const items = this.getFilteredItems();
    return this.groupItems(items);
  }

  get hasVisibleNotifications(): boolean {
    return this.getFilteredItems().length > 0;
  }

  get totalVisibleCount(): number {
    return this.getFilteredItems().length;
  }

  ngOnInit(): void {
    this.sub = this.notificationService.notifications$.subscribe(() => {
      this.notifications = this.notificationService.getForHebergeur(this.hebergeurId);
    });
    this.loadBackendNotifs();
  }

  loadBackendNotifs(): void {
    this.notificationClientService.getMyNotifications().subscribe(ns => {
      this.backendNotifs = ns;
      this.autoCleanupBackendNotifications();
      ns.forEach((n) => {
        if (!n.isRead) {
          this.notificationClientService.markAsRead(n.id).subscribe(() => {
            n.isRead = true;
          });
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.sub?.unsubscribe();
  }

  markAsRead(notif: HostNotification): void {
    if (!notif.read) {
      this.notificationService.markAsRead(notif.id);
    }
  }

  markBackendAsRead(notif: BackendNotification): void {
    if (!notif.isRead) {
      this.notificationClientService.markAsRead(notif.id).subscribe(() => {
        notif.isRead = true;
      });
    }
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead(this.hebergeurId);
    this.backendNotifs.forEach((n) => {
      if (!n.isRead) this.markBackendAsRead(n);
    });
  }

  setFilter(filter: NotificationViewFilter): void {
    this.viewFilter = filter;
  }

  archiveLocalNotification(notif: HostNotification, event?: Event): void {
    event?.stopPropagation();
    if (this.localArchivedIds.has(notif.id)) {
      this.localArchivedIds.delete(notif.id);
    } else {
      this.localArchivedIds.add(notif.id);
    }
    this.persistArchivedLocalIds();
  }

  archiveBackendNotification(notif: BackendNotification, event?: Event): void {
    event?.stopPropagation();
    if (this.backendArchivedIds.has(notif.id)) {
      this.backendArchivedIds.delete(notif.id);
    } else {
      this.backendArchivedIds.add(notif.id);
    }
    this.persistArchivedBackendIds();
  }

  clearAll(): void {
    this.notificationService.clearAll(this.hebergeurId);
  }

  getGroupCount(key: NotificationGroupKey): number {
    return this.getFilteredItems().filter((item) => item.kind === key).length;
  }

  getFilterCount(filter: NotificationViewFilter): number {
    if (filter === 'all') return this.getAllItems().filter((item) => !item.archived).length;
    if (filter === 'important') return this.getAllItems().filter((item) => item.important && !item.archived).length;
    return this.getAllItems().filter((item) => item.archived).length;
  }

  getArchiveLabel(item: UnifiedNotificationItem): string {
    return item.archived ? 'Restaurer' : 'Archiver';
  }

  getArchiveIcon(item: UnifiedNotificationItem): string {
    return item.archived ? 'unarchive' : 'archive';
  }

  getDeleteButtonTitle(): string {
    return 'Delete';
  }

  toggleArchive(item: UnifiedNotificationItem, event?: Event): void {
    event?.stopPropagation();
    if (item.source === 'local' && item.rawLocal) {
      this.archiveLocalNotification(item.rawLocal, event);
      return;
    }
    if (item.source === 'backend' && item.rawBackend) {
      this.archiveBackendNotification(item.rawBackend, event);
    }
  }

  archiveItem(item: UnifiedNotificationItem, event?: Event): void {
    this.toggleArchive(item, event);
  }

  deleteItem(item: UnifiedNotificationItem, event?: Event): void {
    event?.stopPropagation();

    if (item.source === 'local' && item.rawLocal) {
      this.notificationService.deleteNotification(item.rawLocal.id);
      this.localArchivedIds.delete(item.rawLocal.id);
      this.persistArchivedLocalIds();
      return;
    }

    if (item.source === 'backend' && item.rawBackend) {
      this.notificationClientService.deleteNotification(item.rawBackend.id).subscribe({
        next: () => {
          this.backendNotifs = this.backendNotifs.filter((n) => n.id !== item.rawBackend?.id);
          this.backendArchivedIds.delete(item.rawBackend!.id);
          this.persistArchivedBackendIds();
        }
      });
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }

  timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "à l'instant";
    if (mins < 60) return `il y a ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `il y a ${hours}h`;
    const days = Math.floor(hours / 24);
    return `il y a ${days}j`;
  }

  isReclamationNotification(item: UnifiedNotificationItem): boolean {
    return item.source === 'local' && item.rawLocal?.type === 'reclamation';
  }

  isReclamationOpen(item: UnifiedNotificationItem): boolean {
    return this.openedReclamationId === item.id;
  }

  toggleReclamationPanel(item: UnifiedNotificationItem, event?: Event): void {
    event?.stopPropagation();
    if (!this.isReclamationNotification(item)) return;

    if (this.openedReclamationId === item.id) {
      this.openedReclamationId = null;
      this.openedReclamation = null;
      return;
    }

    this.openedReclamationId = item.id;
    this.openedReclamation = this.resolveReclamation(item);
    if (item.source === 'local' && item.rawLocal && !item.rawLocal.read) {
      this.markAsRead(item.rawLocal);
    }
  }

  sendReclamationReply(reclamationId: string): void {
    const rec = this.openedReclamation;
    if (!rec || rec.id !== reclamationId) return;

    const text = (this.replyDrafts[rec.id] || '').trim();
    if (!text) return;

    this.replyingReclamationId = rec.id;
    this.reclamationService.addReply(
      rec.id,
      this.hebergeurId,
      this.authService.getCurrentUser()?.username || this.authService.getCurrentUser()?.email || 'Equipe TunisiaTour',
      'HEBERGEUR',
      text
    );

    this.replyDrafts[rec.id] = '';
    this.replyingReclamationId = null;
    this.notifications = this.notificationService.getForHebergeur(this.hebergeurId);
    this.openedReclamation = this.reclamationService.getById(rec.id);
  }

  goToReclamation(item: UnifiedNotificationItem, event?: Event): void {
    event?.stopPropagation();

    const rec = this.resolveReclamation(item);
    if (!rec) {
      this.router.navigate(['/hebergeur/reclamations']);
      return;
    }

    if (item.source === 'local' && item.rawLocal && !item.rawLocal.read) {
      this.markAsRead(item.rawLocal);
    }

    this.router.navigate(['/hebergeur/reclamations'], {
      queryParams: { reclamationId: rec.id }
    });
  }

  private resolveReclamation(item: UnifiedNotificationItem): ReclamationItem | null {
    try {
      if (item.reclamationId) {
        return this.reclamationService.getById(item.reclamationId);
      }

      const allForHost = this.reclamationService.getByHebergeur(this.hebergeurId);
      const hintedTitle = (item.message.split(':')[1] || '').trim().toLowerCase();

      const byTitleAndLogement = allForHost.find((rec) => {
        const sameLogement = rec.logementNom === (item.rawLocal?.logementNom || '');
        const sameTitle = hintedTitle ? rec.title.toLowerCase() === hintedTitle : false;
        return sameLogement && sameTitle;
      });

      return byTitleAndLogement ?? null;
    } catch {
      return null;
    }
  }

  inferBackendKind(message: string): NotificationGroupKey {
    const text = (message || '').toLowerCase();
    if (text.includes('réserv') || text.includes('reservation')) return 'reservation';
    if (text.includes('paiement') || text.includes('payment')) return 'payment';
    if (text.includes('message') || text.includes('client') || text.includes('réponse')) return 'message';
    return 'admin_action';
  }

  getAllItems(): UnifiedNotificationItem[] {
    const localItems = this.notifications.map((notif) => this.mapLocalNotification(notif));
    const backendItems = this.backendNotifs.map((notif) => this.mapBackendNotification(notif));
    return [...backendItems, ...localItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  getFilteredItems(): UnifiedNotificationItem[] {
    const items = this.getAllItems();
    if (this.viewFilter === 'archived') return items.filter((item) => item.archived);
    if (this.viewFilter === 'important') return items.filter((item) => item.important && !item.archived);
    return items.filter((item) => !item.archived);
  }

  groupItems(items: UnifiedNotificationItem[]): NotificationGroup[] {
    const order: NotificationGroupKey[] = ['reservation', 'message', 'admin_action', 'payment'];
    const labels: Record<NotificationGroupKey, { label: string; icon: string }> = {
      reservation: { label: 'Reservations', icon: 'event_available' },
      message: { label: 'Messages', icon: 'mail' },
      admin_action: { label: 'Actions TunisiaTour', icon: 'admin_panel_settings' },
      payment: { label: 'Paiements', icon: 'payments' }
    };

    return order
      .map((key) => ({
        key,
        label: labels[key].label,
        icon: labels[key].icon,
        items: items.filter((item) => item.kind === key)
      }))
      .filter((group) => group.items.length > 0);
  }

  mapLocalNotification(notif: HostNotification): UnifiedNotificationItem {
    const archived = this.localArchivedIds.has(notif.id);
    const isReclamation = notif.type === 'reclamation';
    return {
      id: this.localItemId(notif.id),
      source: 'local',
      kind: isReclamation ? 'message' : 'admin_action',
      title: isReclamation
        ? 'Nouvelle reclamation client'
        : notif.type === 'modification'
          ? 'Logement modifie'
          : 'Logement supprime',
      message: notif.message,
      date: notif.date,
      read: notif.read,
      archived,
      important: true,
      accent: isReclamation ? 'amber' : notif.type === 'modification' ? 'teal' : 'slate',
      reason: notif.reason,
      reclamationId: notif.reclamationId,
      rawLocal: notif
    };
  }

  mapBackendNotification(notif: BackendNotification): UnifiedNotificationItem {
    const kind = this.inferBackendKind(notif.message);
    const archived = this.backendArchivedIds.has(notif.id);
    return {
      id: this.backendItemId(notif.id),
      source: 'backend',
      kind,
      title: this.getKindLabel(kind),
      message: notif.message,
      date: notif.createdAt,
      read: notif.isRead,
      archived,
      important: false,
      accent: kind === 'reservation' ? 'emerald' : kind === 'payment' ? 'amber' : kind === 'message' ? 'cyan' : 'slate',
      rawBackend: notif
    };
  }

  getKindLabel(kind: NotificationGroupKey): string {
    if (kind === 'reservation') return 'Reservation';
    if (kind === 'message') return 'Message';
    if (kind === 'payment') return 'Paiement';
    return 'Action TunisiaTour';
  }

  getAccentClasses(accent: UnifiedNotificationItem['accent']): string {
    if (accent === 'emerald') return 'bg-emerald-100 text-emerald-700';
    if (accent === 'amber') return 'bg-amber-100 text-amber-700';
    if (accent === 'teal') return 'bg-teal-100 text-teal-700';
    if (accent === 'cyan') return 'bg-cyan-100 text-cyan-700';
    return 'bg-slate-100 text-slate-700';
  }

  getArchiveBadgeClass(item: UnifiedNotificationItem): string {
    return item.archived ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-slate-50 text-slate-500 border-slate-200';
  }

  autoCleanupBackendNotifications(): void {
    const now = Date.now();
    this.backendNotifs.forEach((notif) => {
      const maxDays = 30;
      const ageDays = Math.floor((now - new Date(notif.createdAt).getTime()) / 86400000);

      if (ageDays >= maxDays && !this.backendArchivedIds.has(notif.id)) {
        this.notificationClientService.deleteNotification(notif.id).subscribe({
          next: () => {
            this.backendNotifs = this.backendNotifs.filter((n) => n.id !== notif.id);
          }
        });
      }
    });
  }

  private localItemId(id: string): string {
    return `local-${id}`;
  }

  private backendItemId(id: number): string {
    return `backend-${id}`;
  }

  private loadStringArray(key: string): string[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private loadNumberArray(key: string): number[] {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private persistArchivedLocalIds(): void {
    localStorage.setItem(this.archivedLocalStorageKey, JSON.stringify([...this.localArchivedIds]));
  }

  private persistArchivedBackendIds(): void {
    localStorage.setItem(this.archivedBackendStorageKey, JSON.stringify([...this.backendArchivedIds]));
  }
}
