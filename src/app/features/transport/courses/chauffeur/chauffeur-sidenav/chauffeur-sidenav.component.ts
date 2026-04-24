import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-chauffeur-sidenav',
  templateUrl: './chauffeur-sidenav.component.html',
  styleUrls: ['./chauffeur-sidenav.component.css'],
})
export class ChauffeurSidenavComponent {
  @Input() activeSection:
    | 'overview'
    | 'courses'
    | 'vehicles'
    | 'earnings'
    | 'wallet'
    | 'history'
    | 'statistics' = 'overview';

  @Input() showCta = true;
  @Input() ctaLabel = 'Prendre une course';
  @Input() ctaDisabled = false;

  @Output() ctaClick = new EventEmitter<void>();

  onCtaClick(): void {
    if (this.ctaDisabled) {
      return;
    }

    this.ctaClick.emit();
  }
}
