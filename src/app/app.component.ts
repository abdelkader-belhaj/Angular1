import { Component } from '@angular/core';
import { Observable } from 'rxjs';
import {
  NotificationService,
  ToastNotification,
} from './features/transport/core/services/notification.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent {
  title = 'notStandaLone01';

  toasts$: Observable<ToastNotification[]>;

  constructor(private notificationService: NotificationService) {
    this.toasts$ = this.notificationService.toasts$;
  }

  dismissToast(id: number): void {
    this.notificationService.dismiss(id);
  }
}
