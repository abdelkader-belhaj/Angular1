import { Component, Input, Output, EventEmitter, HostListener, ElementRef, ViewChild, OnInit } from '@angular/core';

@Component({
  selector: 'app-custom-select',
  template: `
    <div class="custom-select-wrapper" [class.open]="isOpen">
      <button 
        class="custom-select-trigger"
        (click)="toggleDropdown()"
        type="button"
        #trigger
      >
        <span class="selected-value">{{ getSelectedLabel() }}</span>
        <span class="material-symbols-outlined dropdown-arrow">expand_more</span>
      </button>

      <div 
        class="custom-select-dropdown"
        *ngIf="isOpen"
      >
        <div class="dropdown-search" *ngIf="showSearch">
          <div class="search-wrapper">
            <span class="material-symbols-outlined search-icon">search</span>
            <input
              type="text"
              [(ngModel)]="searchText"
              (input)="filterOptions()"
              placeholder="Rechercher..."
              class="search-input"
              #searchInput
            />
          </div>
        </div>

        <div class="dropdown-options">
          <button
            *ngFor="let option of filteredOptions"
            class="dropdown-option"
            [class.selected]="option.value === selectedValue"
            (click)="selectOption(option)"
            type="button"
          >
            <span class="option-label">{{ option.label }}</span>
            <span class="material-symbols-outlined check-icon" *ngIf="option.value === selectedValue">check</span>
          </button>

          <div class="dropdown-empty" *ngIf="filteredOptions.length === 0">
            Aucune option trouvée
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .custom-select-wrapper {
      position: relative;
      width: 100%;
    }

    .custom-select-trigger {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 2px solid #e8eff7;
      border-radius: 0.75rem;
      background-color: white;
      color: #003974;
      font-weight: 500;
      font-size: 0.875rem;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      transition: all 0.3s ease;
      text-align: left;
    }

    .custom-select-trigger:hover {
      border-color: #003974;
      box-shadow: 0 2px 8px rgba(0, 57, 116, 0.1);
    }

    .custom-select-trigger:focus {
      outline: none;
      border-color: #003974;
      box-shadow: 0 0 0 3px rgba(0, 57, 116, 0.1);
    }

    .custom-select-wrapper.open .custom-select-trigger {
      border-color: #003974;
      box-shadow: 0 4px 12px rgba(0, 57, 116, 0.15);
      border-radius: 0.75rem 0.75rem 0 0;
    }

    .dropdown-arrow {
      font-size: 1.25rem;
      color: #003974;
      transition: transform 0.3s ease;
      margin-left: 0.5rem;
      flex-shrink: 0;
    }

    .custom-select-wrapper.open .dropdown-arrow {
      transform: rotate(180deg);
    }

    .selected-value {
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .custom-select-dropdown {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background-color: white;
      border: 2px solid #003974;
      border-top: none;
      border-radius: 0 0 0.75rem 0.75rem;
      box-shadow: 0 10px 30px rgba(0, 57, 116, 0.15);
      z-index: 1000;
      min-width: 100%;
      animation: slideDown 0.3s ease forwards;
      max-height: 400px;
      overflow-y: auto;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .dropdown-search {
      padding: 0.75rem;
      border-bottom: 1px solid #e8eff7;
      position: sticky;
      top: 0;
      background-color: white;
    }

    .search-wrapper {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-input {
      width: 100%;
      padding: 0.5rem 0.5rem 0.5rem 2rem;
      border: 1px solid #e8eff7;
      border-radius: 0.5rem;
      font-size: 0.875rem;
    }

    .search-input:focus {
      outline: none;
      border-color: #003974;
      box-shadow: 0 0 0 2px rgba(0, 57, 116, 0.1);
    }

    .search-icon {
      position: absolute;
      left: 0.5rem;
      font-size: 1rem;
      color: #5f6874;
      pointer-events: none;
    }

    .dropdown-options {
      padding: 0.5rem 0;
    }

    .dropdown-option {
      width: 100%;
      padding: 0.75rem 1rem;
      border: none;
      background-color: transparent;
      color: #003974;
      cursor: pointer;
      display: flex;
      justify-content: space-between;
      align-items: center;
      text-align: left;
      font-size: 0.875rem;
      transition: all 0.2s ease;
      position: relative;
    }

    .dropdown-option:hover {
      background-color: #f0f5fb;
    }

    .dropdown-option.selected {
      background: linear-gradient(135deg, rgba(0, 57, 116, 0.08) 0%, rgba(0, 42, 84, 0.04) 100%);
      color: #003974;
      font-weight: 600;
    }

    .dropdown-option.selected::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, #003974 0%, #002a54 100%);
    }

    .check-icon {
      font-size: 1.25rem;
      color: #003974;
      margin-left: 0.5rem;
      flex-shrink: 0;
    }

    .option-label {
      flex: 1;
    }

    .dropdown-empty {
      padding: 1rem;
      text-align: center;
      color: #5f6874;
      font-size: 0.875rem;
    }

    /* Scrollbar styling */
    .custom-select-dropdown::-webkit-scrollbar {
      width: 6px;
    }

    .custom-select-dropdown::-webkit-scrollbar-track {
      background: transparent;
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb {
      background: #e8eff7;
      border-radius: 3px;
    }

    .custom-select-dropdown::-webkit-scrollbar-thumb:hover {
      background: #003974;
    }
  `]
})
export class CustomSelectComponent implements OnInit {
  @Input() options: Array<{ label: string; value: string }> = [];
  @Input() selectedValue: string = '';
  @Input() placeholder: string = 'Sélectionner...';
  @Input() showSearch: boolean = false;
  @Output() onChange = new EventEmitter<string>();

  @ViewChild('trigger') triggerButton!: ElementRef;
  @ViewChild('searchInput') searchInput!: ElementRef;

  isOpen = false;
  searchText = '';
  filteredOptions: Array<{ label: string; value: string }> = [];

  constructor(private elementRef: ElementRef) {}

  ngOnInit(): void {
    this.filteredOptions = [...this.options];
  }

  ngOnChanges(): void {
    this.filteredOptions = [...this.options];
  }

  toggleDropdown(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen && this.showSearch) {
      setTimeout(() => this.searchInput?.nativeElement?.focus(), 0);
    }
  }

  selectOption(option: { label: string; value: string }): void {
    this.selectedValue = option.value;
    this.onChange.emit(option.value);
    this.isOpen = false;
    this.searchText = '';
    this.filterOptions();
  }

  getSelectedLabel(): string {
    const selected = this.options.find(o => o.value === this.selectedValue);
    return selected ? selected.label : this.placeholder;
  }

  filterOptions(): void {
    if (!this.searchText) {
      this.filteredOptions = [...this.options];
    } else {
      this.filteredOptions = this.options.filter(option =>
        option.label.toLowerCase().includes(this.searchText.toLowerCase())
      );
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.elementRef.nativeElement.contains(event.target)) {
      this.isOpen = false;
    }
  }
}
