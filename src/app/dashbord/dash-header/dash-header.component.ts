import { Component, HostListener, Input, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { NotificationService, HostNotification } from '../../services/accommodation/notification.service';

@Component({
  selector: 'app-dash-header',
  templateUrl: './dash-header.component.html',
  styleUrl: './dash-header.component.css'
})
export class DashHeaderComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificationService = inject(NotificationService);

  @Input() showContextBlock = false;

  isAccountMenuOpen = false;
  notifications: HostNotification[] = [];
  showNotifPanel = false;
  private readonly adminId = 0;

  ngOnInit(): void {
    this.notificationService.notifications$.subscribe(all => {
      this.notifications = all.filter(n => n.hebergeurId === this.adminId);
    });
  }

  get unreadCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  toggleNotifPanel(event: MouseEvent): void {
    event.stopPropagation();
    this.showNotifPanel = !this.showNotifPanel;
  }

  markAsRead(id: string): void {
    this.notificationService.markAsRead(id);
  }

  markAllAsRead(): void {
    this.notificationService.markAllAsRead(this.adminId);
  }

  deleteNotification(id: string): void {
    this.notificationService.deleteNotification(id);
  }

  get currentUserName(): string {
    return this.authService.getCurrentUser()?.username ?? 'Administrateur';
  }

  toggleAccountMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.isAccountMenuOpen = !this.isAccountMenuOpen;
  }

  async goToProfile(): Promise<void> {
    this.isAccountMenuOpen = false;
    await this.router.navigate(['/profile']);
  }

  async logout(): Promise<void> {
    this.isAccountMenuOpen = false;
    await firstValueFrom(this.authService.logout());
    await this.router.navigate(['/']);
  }

  @HostListener('document:click')
  closeAccountMenuOnOutsideClick(): void {
    this.isAccountMenuOpen = false;
    this.showNotifPanel = false;
  }
}