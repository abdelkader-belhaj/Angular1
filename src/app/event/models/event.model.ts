// src/app/event/models/event.model.ts

export type EventType         = 'EVENT' | 'ACTIVITY';
export type EventStatus       = 'DRAFT' | 'PUBLISHED' | 'REJECTED' | 'CANCELLED';
export type PromoType         = 'NONE' | 'WEEKEND' | 'HOLIDAY' | 'CUSTOM';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type PaymentStatus     = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';

// ── EventActivityResponse (champs exacts du backend) ─────────
export interface EventActivity {
  id:             number;
  title:          string;
  description:    string;
  price:          number;
  capacity:       number;
  availableSeats: number;
  startDate:      string;
  endDate:        string;
  city:           string;
  address:        string;
  latitude:       number | null;
  longitude:      number | null;
  imageUrl:       string | null;
  type:           EventType;
  status:         EventStatus;
  promoType?:     PromoType;
  promoPercent?:  number | null;
  promoCode?:     string | null;
  promoStartDate?: string | null;
  promoEndDate?:   string | null;
  createdAt:      string;
  updatedAt:      string;
  moderatedAt?:   string | null;
  moderatedByEmail?: string | null;
  moderationReason?: string | null;
  cancellationReason?: string | null;
  categoryId:     number;
  categoryName:   string | null;
  organizerId:    number;
  organizerName:  string;
}

// ── EventCategoryResponse ────────────────────────────────────
export interface EventCategory {
  id:          number;
  name:        string;
  description: string;
  type:        'EVENT' | 'ACTIVITY';
}

export interface EventActivityRequest {
  title: string;
  description: string;
  price: number;
  capacity: number;
  startDate: string;
  endDate: string;
  city: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  imageUrl: string | null;
  type: EventType;
  categoryId: number;
  promoType?: PromoType;
  promoPercent?: number | null;
  promoCode?: string | null;
  promoStartDate?: string | null;
  promoEndDate?: string | null;
}

// ── EventReservationRequest ──────────────────────────────────
export interface EventReservationRequest {
  numberOfTickets: number;
  eventId:         number;
}

// ── EventReservationResponse ─────────────────────────────────
export interface EventReservation {
  id:              number;
  reservationDate: string;
  numberOfTickets: number;
  totalPrice:      number;
  status:          ReservationStatus;
  eventId:         number;
  eventTitle:      string;
  eventPrice:      number;
  userId:          number;
  userName:        string;
  qrUsed?:         boolean;
  qrUsedAt?:       string | null;
  qrUsedBy?:       string | null;
}

// ── EventPaymentRequest ──────────────────────────────────────
export interface EventPaymentRequest {
  amount:         number;
  paymentMethod:  string;
  currency:       string;
  transactionId?: string;
  reservationId:  number;
  promoCode?:     string | null;
}

// ── EventPaymentResponse ─────────────────────────────────────
export interface EventPayment {
  id:            number;
  amount:        number;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  transactionId: string;
  paymentDate:   string;
  currency:      string;
  createdAt:     string;
  reservationId: number;
  eventTitle:    string;
  userName:      string;
}

export interface EventQrScanResult {
  valid: boolean;
  message: string;
}

export interface EventVisionAnalysisResult {
  valid: boolean;
  message: string;
  extractedData?: string | null;
  reservationId?: number;
  alreadyUsed?: boolean;
}

export interface EventReview {
  id: number;
  eventId: number;
  userId: number | null;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface EventReviewRequest {
  rating: number;
  comment: string;
}

export interface EventTicket {
  id: number;
  ticketCode: string;
  ticketNumber: number;
  status: 'AVAILABLE' | 'USED' | 'CANCELLED' | string;
  used: boolean;
  usedAt?: string | null;
  usedBy?: string | null;
  reservationId: number;
  eventId: number;
  eventTitle: string;
  ownerUserId: number;
  ownerName: string;
}

// ── WeatherData (backend WeatherService.WeatherData) ─────────
export interface WeatherData {
  temperature: number;
  feelsLike:   number;
  humidity:    number;
  description: string;
  icon:        string;
  windSpeed:   number;
  city:        string;
  country:     string;
  retrievedAt: string;
}

// ── WeatherInfo = alias de WeatherData (compatibilité) ───────
// Utilisé dans event-list et events-section
export type WeatherInfo = WeatherData;

// ── DiscountInfo ─────────────────────────────────────────────
// label est string (jamais null) — '' si pas de promo
export interface DiscountInfo {
  hasDiscount:     boolean;
  percent:         number;
  discountPercent: number;   // alias de percent
  finalPrice:      number;
  discountedPrice: number;   // alias de finalPrice
  originalPrice:   number;
  label:           string;   // ← string, jamais null
  reason:          string;   // alias de label
}

// ── EventFilter ──────────────────────────────────────────────
export interface EventFilter {
  type?:      EventType;
  categoryId?: number;
  city?:       string;
  search?:     string;
  priceMin?:   number;
  priceMax?:   number;
}

// ── Fallback images ──────────────────────────────────────────
export function getFallbackImageByCategoryName(name: string | null | undefined): string {
  const n = (name ?? '').toLowerCase();
  if (n.includes('concert') || n.includes('musique')) return 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800';
  if (n.includes('festival'))   return 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800';
  if (n.includes('ski'))        return 'https://images.unsplash.com/photo-1548516173-3cabfa4607e9?w=800';
  if (n.includes('plong'))      return 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800';
  if (n.includes('quad') || n.includes('sahara')) return 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800';
  if (n.includes('randon'))     return 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800';
  if (n.includes('gastro') || n.includes('dîner')) return 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800';
  if (n.includes('cultur'))     return 'https://images.unsplash.com/photo-1571115764595-644a1f56a55c?w=800';
  if (n.includes('plage') || n.includes('mer')) return 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800';
  if (n.includes('nuit') || n.includes('night')) return 'https://images.unsplash.com/photo-1566737236500-c8ac43014a67?w=800';
  if (n.includes('nature') || n.includes('aventure')) return 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800';
  if (n.includes('artisan') || n.includes('tradition')) return 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800';
  return 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800';
}

// Alias pour compatibilité avec l'ancien code
export function getCategoryImage(name: string | null | undefined): string {
  return getFallbackImageByCategoryName(name);
}

// ── DEMO_EVENTS ──────────────────────────────────────────────
export const DEMO_EVENTS: EventActivity[] = [
  {
    id: 1, title: 'Festival de Carthage',
    description: 'Le plus grand festival culturel de Tunisie dans l\'amphithéâtre antique de Carthage. Musique, danse, théâtre sous les étoiles.',
    price: 85, capacity: 5000, availableSeats: 842,
    startDate: '2026-07-15T20:00:00', endDate: '2026-07-15T23:30:00',
    city: 'Tunis', address: 'Amphithéâtre de Carthage',
    latitude: 36.859, longitude: 10.33,
    imageUrl: 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800',
    type: 'EVENT', status: 'PUBLISHED',
    categoryId: 1, categoryName: 'Festival',
    organizerId: 1, organizerName: 'Festival Carthage', createdAt: '', updatedAt: '',
  },
  {
    id: 2, title: 'Jazz Nights El Jem',
    description: 'Une nuit de jazz envoûtante dans le Colisée d\'El Jem avec des artistes internationaux.',
    price: 65, capacity: 2000, availableSeats: 356,
    startDate: '2026-08-05T21:00:00', endDate: '2026-08-06T01:00:00',
    city: 'El Jem', address: 'Colisée d\'El Jem',
    latitude: 35.296, longitude: 9.001,
    imageUrl: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800',
    type: 'EVENT', status: 'PUBLISHED',
    categoryId: 2, categoryName: 'Concert',
    organizerId: 2, organizerName: 'Jazz Nights TN', createdAt: '', updatedAt: '',
  },
  {
    id: 3, title: 'Ski Ain Draham',
    description: 'Weekend ski dans les montagnes verdoyantes de Ain Draham. Équipement et moniteur inclus.',
    price: 150, capacity: 40, availableSeats: 6,
    startDate: '2026-12-20T09:00:00', endDate: '2026-12-21T17:00:00',
    city: 'Jendouba', address: 'Station Ski Ain Draham',
    latitude: 36.779, longitude: 8.689,
    imageUrl: 'https://images.unsplash.com/photo-1548516173-3cabfa4607e9?w=800',
    type: 'ACTIVITY', status: 'PUBLISHED',
    categoryId: 3, categoryName: 'Ski',
    organizerId: 3, organizerName: 'Ain Draham Ski', createdAt: '', updatedAt: '',
  },
  {
    id: 4, title: 'Plongée Tabarka',
    description: 'Découvrez les fonds marins de Tabarka. Guide PADI certifié inclus.',
    price: 120, capacity: 16, availableSeats: 5,
    startDate: '2026-06-10T09:00:00', endDate: '2026-06-10T14:00:00',
    city: 'Tabarka', address: 'Club Nautique Tabarka',
    latitude: 36.954, longitude: 8.757,
    imageUrl: 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800',
    type: 'ACTIVITY', status: 'PUBLISHED',
    categoryId: 4, categoryName: 'Plongée',
    organizerId: 4, organizerName: 'Tabarka Dive', createdAt: '', updatedAt: '',
  },
  {
    id: 5, title: 'Safari Quad Douz',
    description: 'Aventure en quad dans les dunes du Grand Erg Oriental. Coucher de soleil + dîner berbère.',
    price: 180, capacity: 20, availableSeats: 8,
    startDate: '2026-05-18T15:00:00', endDate: '2026-05-18T21:00:00',
    city: 'Douz', address: 'Porte du Désert',
    latitude: 33.459, longitude: 9.022,
    imageUrl: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
    type: 'ACTIVITY', status: 'PUBLISHED',
    categoryId: 5, categoryName: 'Quad',
    organizerId: 5, organizerName: 'Sahara Adventures', createdAt: '', updatedAt: '',
  },
  {
    id: 6, title: 'Dîner Sidi Bou Saïd',
    description: 'Soirée culinaire exclusive avec chef étoilé et vue sur la Méditerranée.',
    price: 220, capacity: 30, availableSeats: 7,
    startDate: '2026-06-14T19:00:00', endDate: '2026-06-14T23:00:00',
    city: 'Sidi Bou Saïd', address: 'Restaurant Dar Zarrouk',
    latitude: 36.871, longitude: 10.341,
    imageUrl: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=800',
    type: 'EVENT', status: 'PUBLISHED',
    categoryId: 6, categoryName: 'Gastronomie',
    organizerId: 6, organizerName: 'Fine Dining TN', createdAt: '', updatedAt: '',
  },
];
