import { Component, OnInit, inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

const NOTIFY_KEY = 'hosthub_notify_prefs';

export interface NotifyPrefs {
  emailReservations: boolean;
  emailMessages: boolean;
  pushMarketing: boolean;
}

@Component({
  selector: 'app-hebergeur-settings',
  templateUrl: './hebergeur-settings.component.html',
  styleUrl: './hebergeur-settings.component.css'
})
export class HebergeurSettingsComponent implements OnInit {
  private readonly authService = inject(AuthService);

  tab: 'profil' | 'notifications' | 'securite' = 'profil';

  notify: NotifyPrefs = {
    emailReservations: true,
    emailMessages: true,
    pushMarketing: false
  };

  ngOnInit(): void {
    const raw = localStorage.getItem(NOTIFY_KEY);
    if (raw) {
      try {
        this.notify = { ...this.notify, ...JSON.parse(raw) };
      } catch {
        /* ignore */
      }
    }
  }

  get user() {
    const u = this.authService.getCurrentUser();
    return {
      id: u?.id,
      username: u?.username || '—',
      email: u?.email || '—',
      role: u?.role || 'HEBERGEUR'
    };
  }

  saveNotify(): void {
    localStorage.setItem(NOTIFY_KEY, JSON.stringify(this.notify));
  }

  setTab(t: 'profil' | 'notifications' | 'securite'): void {
    this.tab = t;
  }
}
