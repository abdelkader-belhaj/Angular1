import { Component, EventEmitter, Output, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, FormsModule } from '@angular/forms';

@Component({
  selector: 'app-date-range-picker',
  standalone: false,
  templateUrl: './date-range-picker.component.html',
  styleUrl: './date-range-picker.component.css'
})
export class DateRangePickerComponent {
  @Output() rangeSelected = new EventEmitter<{ start: Date; end: Date }>();

  currentMonth: Date = new Date();
  selectedStart: Date | null = null;
  selectedEnd: Date | null = null;
  daysInMonth: (Date | null)[] = [];
  weekDays = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

  ngOnInit(): void {
    this.generateCalendar();
  }

  generateCalendar(): void {
    const year = this.currentMonth.getFullYear();
    const month = this.currentMonth.getMonth();
    
    const firstDay = new Date(year, month, 1).getDay();
    const lastDate = new Date(year, month + 1, 0).getDate();
    
    this.daysInMonth = [];
    
    // Jours vides avant le 1er du mois
    for (let i = 0; i < (firstDay === 0 ? 6 : firstDay - 1); i++) {
      this.daysInMonth.push(null);
    }
    
    // Jours du mois
    for (let i = 1; i <= lastDate; i++) {
      this.daysInMonth.push(new Date(year, month, i));
    }
  }

  selectDate(day: Date | null): void {
    if (!day) return;
    
    if (!this.selectedStart || (this.selectedStart && this.selectedEnd)) {
      this.selectedStart = day;
      this.selectedEnd = null;
    } else if (day < this.selectedStart) {
      this.selectedEnd = this.selectedStart;
      this.selectedStart = day;
      this.rangeSelected.emit({ start: this.selectedStart, end: this.selectedEnd });
    } else if (day > this.selectedStart) {
      this.selectedEnd = day;
      this.rangeSelected.emit({ start: this.selectedStart, end: this.selectedEnd });
    }
  }

  isInRange(day: Date | null): boolean {
    if (!day || !this.selectedStart || !this.selectedEnd) return false;
    return day >= this.selectedStart && day <= this.selectedEnd;
  }

  isSelectedDate(day: Date | null): boolean {
    if (!day) return false;
    const startMatch = this.selectedStart && this.isSameDay(day, this.selectedStart);
    const endMatch = this.selectedEnd && this.isSameDay(day, this.selectedEnd);
    return !!(startMatch || endMatch);
  }

  isSameDay(d1: Date, d2: Date): boolean {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  isPastDate(day: Date | null): boolean {
    if (!day) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return day < today;
  }

  prevMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() - 1);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentMonth = new Date(this.currentMonth.getFullYear(), this.currentMonth.getMonth() + 1);
    this.generateCalendar();
  }

  formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  }

  getMonthYear(): string {
    const months = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 
                    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
    return `${months[this.currentMonth.getMonth()]} ${this.currentMonth.getFullYear()}`;
  }
}
