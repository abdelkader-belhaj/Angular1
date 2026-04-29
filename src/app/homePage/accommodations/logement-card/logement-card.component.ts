import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Logement } from '../../../services/accommodation/logement.service';

@Component({
  selector: 'app-logement-card',
  templateUrl: './logement-card.component.html',
  styleUrls: ['./logement-card.component.css', './stars-animation.css']
})
export class LogementCardComponent implements OnInit, OnDestroy {
  @Input() logement!: Logement;
  @Input() index: number = 0;
  @Input() aiScore?: number;

  isFavorite: boolean = false;
  isHovered: boolean = false;
  image: string = 'assets/images/default.jpg';
  hostMeta: { nbChambres?: number; surfaceM2?: number; equipements?: string[]; placesDisponibles?: number } = {};
  cleanDescription: string = '';
  priceDisplay: string = '0 DT';
  imageUrls: string[] = [];
  activeImageIndex: number = 0;
  private autoCarouselInterval: any;

  constructor(private router: Router) {}

  ngOnInit(): void {
    const description = this.logement?.description || '';
    this.hostMeta = this.parseHostHubMeta(description);
    this.cleanDescription = this.stripHostHubMeta(description) || 'Bienvenue chez nous ! Un hébergement confortable et accueillant.';
    this.priceDisplay = this.formatPrice(this.logement?.prixNuit);
    
    // Process images with proper path handling
    const rawImages = this.logement?.imageUrls?.length ? this.logement.imageUrls : this.logement?.imageUrl ? [this.logement.imageUrl] : [];
    this.imageUrls = rawImages.map(img => this.processImageUrl(img));
    
    this.activeImageIndex = 0;
    this.startAutoCarousel();
  }

  ngOnDestroy(): void {
    this.stopAutoCarousel();
  }

  startAutoCarousel(): void {
    if (this.imageUrls.length > 1) {
      this.autoCarouselInterval = setInterval(() => {
        this.activeImageIndex = (this.activeImageIndex + 1) % this.imageUrls.length;
      }, 3000);
    }
  }

  stopAutoCarousel(): void {
    if (this.autoCarouselInterval) {
      clearInterval(this.autoCarouselInterval);
    }
  }

  toggleFavorite(event: Event): void {
    event.stopPropagation();
    this.isFavorite = !this.isFavorite;
  }

  navigateToDetails(): void {
    if (this.isMaintenanceMode()) return;
    this.router.navigate(['/logement', this.logement.idLogement]);
  }

  prevImage(event: Event): void {
    event.stopPropagation();
    if (this.imageUrls.length <= 1) return;
    this.activeImageIndex = (this.activeImageIndex + this.imageUrls.length - 1) % this.imageUrls.length;
  }

  nextImage(event: Event): void {
    event.stopPropagation();
    if (this.imageUrls.length <= 1) return;
    this.activeImageIndex = (this.activeImageIndex + 1) % this.imageUrls.length;
  }

  selectImage(index: number, event: Event): void {
    event.stopPropagation();
    this.activeImageIndex = index;
  }

  getDelay(): string {
    return `${(this.index % 6) * 80}ms`;
  }

  setHover(hover: boolean): void {
    this.isHovered = hover;
  }

  getCleanDescription(): string {
    return this.cleanDescription;
  }

  getAvailablePlaces(): number {
    return this.logement?.availablePlaces ?? this.hostMeta.placesDisponibles ?? 0;
  }

  isSaturated(): boolean {
    return !!this.logement?.saturated || this.getAvailablePlaces() <= 0;
  }

  /**
   * 🌟 Retourne les informations des étoiles avec classes CSS pour le style
   */
  getStars(): { filled: boolean; scoreClass: string; index: number }[] {
    if (!this.aiScore) return [];
    const rounded = Math.round(this.aiScore);
    const scoreClass = this.getScoreClass(rounded);
    
    return Array.from({ length: 5 }, (_, i) => ({
      filled: i < rounded,
      scoreClass: i < rounded ? scoreClass : '',
      index: i
    }));
  }

  /**
   * 🎨 Retourne la classe CSS pour la couleur/style du score
   */
  getScoreClass(score: number): string {
    const rounded = Math.round(score);
    switch (rounded) {
      case 1:
        return 'star-score-1';
      case 2:
        return 'star-score-2';
      case 3:
        return 'star-score-3';
      case 4:
        return 'star-score-4';
      case 5:
        return 'star-score-5';
      default:
        return 'star-score-3';
    }
  }

  /**
   * 🔢 Retourne la classe CSS pour le badge du score numérique
   */
  getScoreBadgeClass(score: number): string {
    const rounded = Math.round(score);
    return `score-badge score-${rounded}`;
  }

  getNextAvailableDateLabel(): string {
    if (!this.logement?.nextAvailableDate) return '';
    const date = new Date(this.logement.nextAvailableDate);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  getAvailablePlacesLabel(): string {
    const availablePlaces = this.getAvailablePlaces();
    if (this.isSaturated()) {
      return 'Saturé pour le moment';
    }
    return `${availablePlaces} place${availablePlaces > 1 ? 's' : ''} restante${availablePlaces > 1 ? 's' : ''}`;
  }

  isMaintenanceMode(): boolean {
    return !this.logement?.disponible && !this.isSaturated();
  }

  getMaintenanceLabel(): string {
    return 'Coming Soon';
  }

  private formatPrice(rawPrice: number | string | undefined | null): string {
    if (rawPrice === null || rawPrice === undefined) return '0 DT';

    const numericPrice = typeof rawPrice === 'number'
      ? rawPrice
      : parseFloat(String(rawPrice).replace(/[^0-9,.-]/g, '').replace(',', '.'));

    if (!Number.isFinite(numericPrice)) {
      const cleaned = String(rawPrice).replace(/€|\s/g, '');
      return `${cleaned} DT`;
    }

    return `${numericPrice.toLocaleString('fr-FR', { maximumFractionDigits: 2, minimumFractionDigits: 0 })} DT`;
  }

  private stripHostHubMeta(description: string): string {
    if (!description) return '';
    const cleaned = description.replace(/__HOSTHUB_META__[\s\S]*$/g, '').trim();
    return cleaned.replace(/\s+$/g, '');
  }

  private parseHostHubMeta(description: string): { nbChambres?: number; surfaceM2?: number; equipements?: string[]; placesDisponibles?: number } {
    if (!description) return {};
    const match = description.match(/__HOSTHUB_META__\s*(\{[\s\S]*\})$/);
    if (!match) return {};

    try {
      return JSON.parse(match[1]) as { nbChambres?: number; surfaceM2?: number; equipements?: string[]; placesDisponibles?: number };
    } catch {
      return {};
    }
  }

  currentImageUrl(): string {
    return this.imageUrls[this.activeImageIndex] || 'assets/images/default.jpg';
  }

  private processImageUrl(imageUrl: string): string {
    if (!imageUrl) return 'assets/images/default.jpg';

    const isVideoAsset = /\.(mp4|mov|avi|mkv|webm|m4v)(\?.*)?$/i.test(imageUrl);
    if (isVideoAsset) {
      return 'assets/images/default.jpg';
    }
    
    // If it's already a full URL (http/https), return as is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
      return imageUrl;
    }
    
    // If it starts with assets/, return as is
    if (imageUrl.startsWith('assets/')) {
      return imageUrl;
    }
    
    // Otherwise, assume it's a filename and add the assets/images/ prefix
    return `assets/images/${imageUrl}`;
  }
}
