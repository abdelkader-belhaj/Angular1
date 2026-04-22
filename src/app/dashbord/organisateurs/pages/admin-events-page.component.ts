import { Component, OnInit } from '@angular/core';
import { AdminEventsService } from './admin-events.service';

@Component({
  selector: 'app-admin-events-page',
  templateUrl: './admin-events-page.component.html',
  styleUrl: './admin-events-page.component.css'
})
export class AdminEventsPageComponent implements OnInit {
  stats = {
    totalEvents: 0,
    draftCount: 0,
    publishedCount: 0,
    rejectedCount: 0,
    cancelledCount: 0
  };
  loading = false;

  constructor(private adminEventsService: AdminEventsService) {}

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading = true;
    this.adminEventsService.getEventStats().subscribe({
      next: (data) => {
        this.stats = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Erreur lors du chargement des statistiques', err);
        this.loading = false;
      }
    });
  }
}
