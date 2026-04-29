// src/app/features/transport/core/services/notification.service.ts
//
// Service UI uniquement — pas d'appel HTTP.
// Gère : toasts, sons, notifications locales.
// Les notifications WebSocket arrivent via WebsocketService → ici on les affiche.

import { Injectable } from '@angular/core';
import { BehaviorSubject, Subject } from 'rxjs';
import { DriverNotificationDTO } from '../models';

export interface ToastNotification {
  id: number;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  duration?: number; // ms, défaut 4000
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private toastsSubject = new BehaviorSubject<ToastNotification[]>([]);
  public toasts$ = this.toastsSubject.asObservable();

  // Flux des notifications driver brutes (alimentation depuis WebsocketService)
  private driverNotifSubject = new Subject<DriverNotificationDTO>();
  public driverNotifications$ = this.driverNotifSubject.asObservable();

  private counter = 0;

  // ==================== TOASTS ====================

  success(title: string, message: string, duration = 4000): void {
    this._add({ type: 'success', title, message, duration });
  }

  error(title: string, message: string, duration = 6000): void {
    this._add({ type: 'error', title, message, duration });
  }

  info(title: string, message: string, duration = 4000): void {
    this._add({ type: 'info', title, message, duration });
  }

  warning(title: string, message: string, duration = 5000): void {
    this._add({ type: 'warning', title, message, duration });
  }

  cancellation(title: string, message: string, duration = 6000): void {
    this._add({ type: 'error', title, message, duration });
  }

  dismiss(id: number): void {
    this.toastsSubject.next(
      this.toastsSubject.value.filter((t) => t.id !== id),
    );
  }

  private _add(toast: Omit<ToastNotification, 'id'>): void {
    const id = ++this.counter;
    const newToast: ToastNotification = { ...toast, id };
    this.toastsSubject.next([...this.toastsSubject.value, newToast]);
    setTimeout(() => this.dismiss(id), toast.duration ?? 4000);
  }

  // ==================== DRIVER NOTIFICATIONS ====================
  // Appelé par WebsocketService quand il reçoit un message /queue/notifications

  handleDriverNotification(notification: DriverNotificationDTO): void {
    this.driverNotifSubject.next(notification);

    const notifType = String(notification.type || '').toUpperCase();
    const notifMessage = notification.message ?? '';

    if (notifType.includes('CANCEL')) {
      this.cancellation('Course annulée', notifMessage);
      return;
    }

    switch (notifType) {
      case 'NEW_COURSE':
        this.playNewRideSound();
        this.info('Nouvelle demande', 'Un client vous demande une course');
        break;
      case 'PAYMENT_RECEIVED':
        this.success('Paiement reçu', notifMessage);
        break;
      case 'DEPOSIT_RELEASED':
        this.success(
          notification.titre || 'Caution remboursée',
          notifMessage || 'La caution a été remboursée.',
        );
        break;
    }
  }

  // ==================== SONS ====================

  playNewRideSound(): void {
    try {
      const ctx = new (
        window.AudioContext || (window as any).webkitAudioContext
      )();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.3);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);
    } catch {
      // Navigateur sans AudioContext — silencieux
    }
  }
}
