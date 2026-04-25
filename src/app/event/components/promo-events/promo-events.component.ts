import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { EventActivity } from '../../models/event.model';
import { EventService } from '../../../services/events/event.service';
import { calculateDiscount } from '../../utils/discount.util';

@Component({
  selector: 'app-promo-events',
  templateUrl: './promo-events.component.html',
  styleUrls: ['./promo-events.component.css'],
})
export class PromoEventsComponent implements OnInit {
  loading = true;
  errorMsg = '';
  allPromoEvents: EventActivity[] = [];
  filteredPromoEvents: EventActivity[] = [];
  selectedType: 'ALL' | 'EVENT' | 'ACTIVITY' = 'ALL';

  constructor(
    private readonly eventService: EventService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.loadPromoEvents();
  }

  setType(type: 'ALL' | 'EVENT' | 'ACTIVITY'): void {
    this.selectedType = type;
    this.applyTypeFilter();
  }

  goToAllEvents(): void {
    void this.router.navigate(['/events']);
  }

  private loadPromoEvents(): void {
    this.loading = true;
    this.errorMsg = '';

    this.eventService.getPublished().subscribe({
      next: (events: EventActivity[]) => {
        this.allPromoEvents = events.filter(ev =>
          this.isPromoEvent(ev)
        );
        this.applyTypeFilter();
        this.loading = false;
      },
      error: () => {
        this.errorMsg = 'Impossible de charger les promotions pour le moment.';
        this.loading = false;
      },
    });
  }

  private isPromoEvent(ev: EventActivity): boolean {
    const hasConfiguredCode = !!ev.promoCode?.trim();
    const hasActiveDiscount = calculateDiscount(ev.price, ev.startDate, ev.categoryName, {
      promoType: ev.promoType,
      promoPercent: ev.promoPercent,
      promoCode: ev.promoCode,
      promoStartDate: ev.promoStartDate,
      promoEndDate: ev.promoEndDate,
    }).hasDiscount;

    return hasConfiguredCode || hasActiveDiscount;
  }

  private applyTypeFilter(): void {
    if (this.selectedType === 'ALL') {
      this.filteredPromoEvents = [...this.allPromoEvents];
      return;
    }

    this.filteredPromoEvents = this.allPromoEvents.filter(ev => ev.type === this.selectedType);
  }
}
