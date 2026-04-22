import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { EventActivity } from '../../models/event.model';
import { EventAiAssistantService } from '../../../services/events/event-ai-assistant.service';

interface Message {
  role: 'user' | 'assistant';
  text: string;
  events?: EventActivity[];
}

@Component({
  selector: 'app-event-assistant',
  templateUrl: './event-assistant.component.html',
  styleUrls: ['./event-assistant.component.css']
})
export class EventAssistantComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() allEvents: EventActivity[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() eventSelected = new EventEmitter<number>();

  messages: Message[] = [];
  userInput = '';
  loading = false;

  constructor(private readonly assistantApi: EventAiAssistantService) {}

  ngOnChanges(): void {
    if (this.isOpen && this.messages.length === 0) {
      this.messages.push({
        role: 'assistant',
        text: '👋 Bonjour ! Je suis votre assistant .\n\n je vous recommande les meilleurs événements en Tunisie !\n\nExemple : "Je suis passionné par la musique et la mer."'
      });
    }
  }

  send(): void {
  if (!this.userInput.trim() || this.loading) return;

  const userMsg = this.userInput.trim();
  this.messages.push({ role: 'user', text: userMsg });
  this.userInput = '';
  this.loading = true;

  this.assistantApi.recommend(userMsg, 4).subscribe({
   next: (res) => {
  const apiEvents = this.mapIdsToEvents(res?.recommendedEventIds ?? []);
  const localEvents = this.getLocalRecommendations(userMsg, 4);
  const events = apiEvents.length > 0 ? apiEvents : localEvents;
  const rawAnswer = res?.answer?.trim() ?? '';
  const answerLooksEmpty = this.looksLikeNoResultAnswer(rawAnswer);
  const answer = answerLooksEmpty && events.length > 0
    ? this.buildLocalSuccessAnswer(userMsg, events.length)
    : (rawAnswer || 'Voici des recommandations pour vous :');

  this.messages.push({
    role: 'assistant',
    text: answer,
    events: events, // ← pas de fallback, liste vide = liste vide
  });
  this.loading = false;
},
    error: () => {
      const fallbackEvents = this.allEvents.slice(0, 3);
      this.messages.push({
        role: 'assistant',
        text: 'Le service IA est indisponible pour le moment. Voici des suggestions populaires :',
        events: fallbackEvents.length > 0 ? fallbackEvents : this.getLocalRecommendations(userMsg, 3),
      });
      this.loading = false;
    }
  });
}

  private normalizeText(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private looksLikeNoResultAnswer(answer: string): boolean {
    const txt = this.normalizeText(answer);
    return txt.includes('aucun evenement')
      || txt.includes('ne correspond')
      || txt.includes('pas de result')
      || txt.includes('aucune recommandation');
  }

  private buildLocalSuccessAnswer(userMsg: string, count: number): string {
    const normalized = this.normalizeText(userMsg);
    const mentionsWeekend = normalized.includes('weekend') || normalized.includes('week-end');
    if (mentionsWeekend) {
      return `J'ai trouvé ${count} suggestion(s) pour ce weekend selon vos préférences.`;
    }
    return `J'ai trouvé ${count} suggestion(s) proches de vos thèmes dans les événements disponibles.`;
  }

  private getLocalRecommendations(userMsg: string, limit: number): EventActivity[] {
    const normalizedQuery = this.normalizeText(userMsg);
    const weekendRequested = normalizedQuery.includes('weekend') || normalizedQuery.includes('week-end');
    const cityTokens = new Set(this.allEvents.map(e => this.normalizeText(e.city)).filter(Boolean));
    const matchedCities = Array.from(cityTokens).filter(city => normalizedQuery.includes(city));

    const themeGroups: Record<string, string[]> = {
      musique: ['musique', 'concert', 'dj', 'festival', 'jazz', 'soiree', 'party', 'live'],
      mer: ['mer', 'plage', 'nautique', 'bateau', 'yacht', 'surf', 'plongee', 'marin', 'croisiere'],
      aventure: ['aventure', 'randonnee', 'trek', 'quad', 'adrenaline', 'kayak', 'exploration'],
      culture: ['culture', 'theatre', 'expo', 'exposition', 'musee', 'patrimoine', 'artisanat'],
      sport: ['sport', 'running', 'marathon', 'fitness', 'yoga', 'training'],
    };

    const requestedThemes = Object.entries(themeGroups)
      .filter(([, keywords]) => keywords.some(k => normalizedQuery.includes(k)))
      .map(([key]) => key);

    const inWeekendRange = (date: Date): boolean => {
      const now = new Date();
      const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const day = base.getDay();
      const daysToSaturday = day === 6 ? 0 : (6 - day + 7) % 7;
      const saturday = new Date(base);
      saturday.setDate(base.getDate() + daysToSaturday);
      const sunday = new Date(saturday);
      sunday.setDate(saturday.getDate() + 1);
      const endSunday = new Date(sunday);
      endSunday.setHours(23, 59, 59, 999);
      return date >= saturday && date <= endSunday;
    };

    const scored = this.allEvents
      .filter(ev => {
        const start = new Date(ev.startDate);
        if (Number.isNaN(start.getTime())) return false;
        if (matchedCities.length > 0 && !matchedCities.includes(this.normalizeText(ev.city))) return false;
        if (weekendRequested && !inWeekendRange(start)) return false;
        return true;
      })
      .map(ev => {
        const text = this.normalizeText(`${ev.title} ${ev.description} ${ev.categoryName ?? ''} ${ev.city}`);
        let score = 0;

        if (ev.status === 'PUBLISHED') score += 4;

        for (const theme of requestedThemes) {
          const keywords = themeGroups[theme] ?? [];
          const hasTheme = keywords.some(k => text.includes(k));
          if (hasTheme) score += 6;
        }

        if (requestedThemes.length === 0) {
          score += 1;
        }

        const startTime = new Date(ev.startDate).getTime();
        const nowTime = Date.now();
        if (startTime >= nowTime) {
          const days = (startTime - nowTime) / 86400000;
          if (days <= 7) score += 2;
        }

        return { ev, score };
      })
      .sort((a, b) => b.score - a.score || new Date(a.ev.startDate).getTime() - new Date(b.ev.startDate).getTime());

    const withThemeIfRequested = requestedThemes.length > 0
      ? scored.filter(item => item.score >= 6)
      : scored;

    const chosen = (withThemeIfRequested.length > 0 ? withThemeIfRequested : scored)
      .slice(0, limit)
      .map(item => item.ev);

    return chosen;
  }

  private mapIdsToEvents(ids: number[]): EventActivity[] {
    if (!ids?.length) {
      return [];
    }

    const byId = new Map(this.allEvents.map(event => [event.id, event]));
    return ids
      .map(id => byId.get(id))
      .filter((event): event is EventActivity => !!event);
  }

  selectEvent(id: number): void {
    this.eventSelected.emit(id);
    this.closed.emit();
  }

  close(): void { this.closed.emit(); }

  onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.send(); }
  }
}