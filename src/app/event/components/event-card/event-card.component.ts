import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { EventActivity, DiscountInfo } from '../../models/event.model';
import { calculateDiscount, defaultEventImage, isAlmostFull } from '../../utils/discount.util';

@Component({
  selector: 'app-event-card',
  templateUrl: './event-card.component.html',
  styleUrls: ['./event-card.component.css']
})
export class EventCardComponent implements OnInit {
  @Input() event!: EventActivity;
  @Input() isReserved = false;
  @Input() isFavorite = false;
  @Output() reserveClicked = new EventEmitter<EventActivity>();
  @Output() favoriteToggled = new EventEmitter<number>();

  discount!: DiscountInfo;
  almostFull = false;

  constructor(private router: Router) {}

  ngOnInit(): void {
    this.discount = calculateDiscount(this.event.price, this.event.startDate, this.event.categoryName);
    this.almostFull = isAlmostFull(this.event.availableSeats, this.event.capacity);
  }

  getImage(): string {
    return this.event.imageUrl || defaultEventImage(this.event.type, this.event.categoryName);
  }

  onImgError(e: Event): void {
    (e.target as HTMLImageElement).src = defaultEventImage(this.event.type, this.event.categoryName);
  }

  goToDetail(): void {
    this.router.navigate(['/events', this.event.id]);
  }

  toggleFavorite(event: MouseEvent): void {
    event.stopPropagation();
    this.favoriteToggled.emit(this.event.id);
  }
}