import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ForumConditionsService } from '../../../services/forum-conditions.service';
export interface ForumCondition {
  icon: string;
  title: string;
  description: string;
  accepted: boolean;
}

@Component({
  selector: 'app-forum-conditions-modal',
  templateUrl: './forum-conditions-modal.component.html',
  styleUrls: ['./forum-conditions-modal.component.css']
})
export class ForumConditionsModalComponent {

  @Input() communityId!: number;
  @Output() accepted = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  constructor(private forumConditionsService: ForumConditionsService) {}

  conditions: ForumCondition[] = [
    {
      icon: '🤝',
      title: 'Respect et courtoisie',
      description: 'Je m\'engage à communiquer avec respect, sans insultes ni discours haineux.',
      accepted: false
    },
    {
      icon: '💡',
      title: 'Contribution constructive',
      description: 'Mes messages apporteront une valeur ajoutée, sans spam ni hors-sujet.',
      accepted: false
    },
    {
      icon: '🔒',
      title: 'Respect de la vie privée',
      description: 'Je ne partagerai pas d\'informations personnelles d\'autrui sans consentement.',
      accepted: false
    },
    {
      icon: '⚖️',
      title: 'Acceptation de la modération',
      description: 'J\'accepte que mes contenus puissent être modérés en cas de non-respect.',
      accepted: false
    },
    {
      icon: '✅',
      title: 'Véracité des informations',
      description: 'Les informations que je partage sont exactes au mieux de mes connaissances.',
      accepted: false
    }
  ];

  toggleCondition(index: number): void {
    this.conditions[index].accepted = !this.conditions[index].accepted;
  }

  get acceptedCount(): number {
    return this.conditions.filter(c => c.accepted).length;
  }

  get allAccepted(): boolean {
    return this.acceptedCount === this.conditions.length;
  }

  get progressPercent(): number {
    return (this.acceptedCount / this.conditions.length) * 100;
  }

  onAccess(): void {
    if (!this.allAccepted) return;
   this.forumConditionsService.markAsAccepted(Number(this.communityId));
    this.accepted.emit();
  }

  onCancel(): void {
    this.cancelled.emit();
  }

  onOverlayClick(event: MouseEvent): void {
    if ((event.target as HTMLElement).classList.contains('modal-overlay')) {
      this.cancelled.emit();
    }
  }
}