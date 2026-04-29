import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of, timeout } from 'rxjs';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AiPricePredictionService {

  private readonly EQUIPMENT_WEIGHTS: Record<string, number> = {
    wifi: 8,
    climatisation: 14,
    cuisineequipee: 16,
    parking: 10,
    piscine: 28,
    machinealaver: 10,
    balconterrasse: 12,
    vuedemer: 35,
    jacuzzi: 22,
    chauffagemoderne: 9,
    ascenseur: 7,
    securite24h24: 11,
    borneelectrique: 8,
    vuemontagne: 14,
    procheplage: 20,
    prochecentreville: 13,
    smarttv: 7,
    espacetravail: 10,
    salledesport: 15,
    sauna: 17
  };

  // Villes tunisiennes pour la détection
  private readonly TUNISIA_CITIES = [
    'tunis', 'sfax', 'sousse', 'monastir', 'hammamet', 'djerba', 'nabeul', 'gafsa', 
    'kairouan', 'tatouine', 'tataouine', 'kasserine', 'sidi bouzid', 'kebili', 'tozeur',
    'medenine', 'manouba', 'ben arous', 'ariana', 'la marsa', 'carthage', 'la goulette',
    'ezzahra', 'msaken', 'mahdia', 'sfax medina', 'erriadh'
  ];

  // Villes/pays européens
  private readonly EUROPE_CITIES = [
    'paris', 'london', 'berlin', 'madrid', 'rome', 'amsterdam', 'barcelona', 'lisbon',
    'wien', 'prague', 'budapest', 'athens', 'moscow', 'istanbul', 'zurich', 'geneva',
    'brussels', 'stockholm', 'oslo', 'copenhagen', 'helsinki', 'warsaw', 'bucharest',
    'sofia', 'athens', 'lisbon', 'dublin', 'dublin', 'reykjavik', 'luxembourg',
    'france', 'germany', 'italy', 'spain', 'uk', 'united kingdom', 'netherlands', 'belgium',
    'switzerland', 'sweden', 'norway', 'denmark', 'finland', 'poland', 'czech', 'austria',
    'portugal', 'greece', 'romania', 'hungary', 'slovenia', 'croatia', 'serbia', 'bulgaria'
  ];

  // NOTE: Gemini API key must be kept on the backend. Frontend calls the server proxy.

  constructor(private http: HttpClient) { }

  /**
   * Predicts a suggested price using Google Gemini API based on lodging parameters.
   * Asynchronous operation.
   */
  predictPrice(description: string, capacity: number, categoryName: string, equipements: string[] = [], city: string = ''): Observable<number> {
    const equipmentBonus = this.getEquipmentBonus(equipements);

    return this.predictBasePrice(description, capacity, categoryName, city).pipe(
      map((basePrice) => {
        const finalPrice = basePrice + equipmentBonus;
        return Math.round(finalPrice / 5) * 5;
      })
    );
  }

  predictBasePrice(description: string, capacity: number, categoryName: string, city: string = ''): Observable<number> {
    // Solution locale pour éviter les erreurs CORS avec l'API Gemini
    console.log('[AI Prediction] Utilisation de la prédiction locale (évite CORS Gemini)');
    
    // Algorithme de prédiction local basé sur les caractéristiques
    let basePrice = 50; // Prix de base
    
    // Ajustement selon la capacité
    basePrice += capacity * 15;
    
    // Ajustement selon la catégorie
    if (categoryName.toLowerCase().includes('lux') || categoryName.toLowerCase().includes('luxe')) {
      basePrice *= 2.5;
    } else if (categoryName.toLowerCase().includes('villa')) {
      basePrice *= 2;
    } else if (categoryName.toLowerCase().includes('appartement')) {
      basePrice *= 1.2;
    } else if (categoryName.toLowerCase().includes('studio')) {
      basePrice *= 0.8;
    }
    
    // Ajustement selon la qualité de la description
    const descLength = description.length;
    if (descLength > 200) {
      basePrice *= 1.2; // Description détaillée = meilleur logement
    } else if (descLength < 50) {
      basePrice *= 0.9; // Description courte = logement simple
    }
    
    // Mots-clés qui augmentent le prix
    const premiumKeywords = ['piscine', 'vue mer', 'luxe', 'jardin', 'terrasse', 'climatisation', 'centre ville', 'proche plage'];
    const keywordBonus = premiumKeywords.reduce((bonus, keyword) => {
      return bonus + (description.toLowerCase().includes(keyword) ? 10 : 0);
    }, 0);
    
    basePrice += keywordBonus;
    
    // NOUVELLE LOGIQUE: Ajustement selon la localisation (ville/pays)
    const locationMultiplier = this.getLocationMultiplier(city);
    basePrice *= locationMultiplier;
    console.log('[AI Prediction] Multiplicateur ville:', locationMultiplier, 'pour', city);
    
    // Arrondir aux 5 dinars près
    const finalPrice = Math.round(basePrice / 5) * 5;
    
    console.log('[AI Prediction] ✅ Prix local calculé:', finalPrice, 'pour', categoryName, capacity, 'personnes, ville:', city);
    
    return of(finalPrice);
  }

  /**
   * Détermine le multiplicateur de prix selon la localisation
   * Europe: +50% (1.5)
   * Tunisie: x1.0 (normal)
   */
  private getLocationMultiplier(city: string): number {
    if (!city || city.trim().length === 0) {
      return 1.0; // Par défaut, pas de multiplicateur
    }

    const cityLower = city.toLowerCase().trim();

    // Vérifier si c'est une ville tunisienne
    if (this.TUNISIA_CITIES.some(tunisCity => cityLower.includes(tunisCity))) {
      console.log('[Location] Tunisie détectée -  multiplicateur: 1.0');
      return 1.0; // Prix normal pour Tunisie
    }

    // Vérifier si c'est une ville/pays européen
    if (this.EUROPE_CITIES.some(europeCity => cityLower.includes(europeCity))) {
      console.log('[Location] Europe détectée - multiplicateur: 1.5 (+50%)');
      return 1.5; // +50% pour Europe
    }

    // Par défaut, si la ville n'est pas reconnue, appliquer +25% (supposé être pays touristique)
    console.log('[Location] Localisation inconnue:', city, '- multiplicateur: 1.25');
    return 1.25;
  }

  getEquipmentBonus(equipements: string[]): number {
    return equipements.reduce((bonus, equip) => {
      const key = this.normalizeEquipmentKey(equip);
      return bonus + (this.EQUIPMENT_WEIGHTS[key] || 0);
    }, 0);
  }

  private normalizeEquipmentKey(equipment: string): string {
    return equipment
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .replace('wifi', 'wifi')
      .replace('climatisation', 'climatisation')
      .replace('cuisineequipee', 'cuisineequipee')
      .replace('parking', 'parking')
      .replace('piscine', 'piscine')
      .replace('machinealaver', 'machinealaver')
      .replace('balconterrasse', 'balconterrasse')
      .replace('vuedemer', 'vuedemer')
      .replace('jacuzzi', 'jacuzzi')
      .replace('chauffagemoderne', 'chauffagemoderne')
      .replace('ascenseur', 'ascenseur')
      .replace('securite24h24', 'securite24h24')
      .replace('borneelectrique', 'borneelectrique')
      .replace('vuemontagne', 'vuemontagne')
      .replace('procheplage', 'procheplage')
      .replace('prochecentreville', 'prochecentreville')
      .replace('smarttv', 'smarttv')
      .replace('espacetravail', 'espacetravail')
      .replace('salledesport', 'salledesport')
      .replace('sauna', 'sauna');
  }

  private localPredictPrice(description: string, capacity: number, categoryName: string): number {
    let basePrice = 50;
    basePrice += capacity * 12;
    
    if (categoryName.toLowerCase().includes('villa')) basePrice *= 1.8;
    else if (categoryName.toLowerCase().includes('appartement')) basePrice *= 1.3;
    else if (categoryName.toLowerCase().includes('studio')) basePrice *= 0.9;
    
    return Math.round(basePrice / 5) * 5;
  }

  private localCorrectDescription(text: string): string {
    let corrected = text
      .replace(/\bvenez\b/gi, 'venez')
      .replace(/\bvite\b/gi, 'vite')
      .replace(/\bzamis\b/gi, 'amis')
      .replace(/!{3,}/g, '!!')
      .replace(/\s{2,}/g, ' ')
      .trim();
    
    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }
    
    return corrected.trim();
  }

  enhanceDescription(description: string): Observable<string> {
    console.log('[Enhance] Appel Groq via backend logement dédié');

    const url = `${environment.apiBaseUrl}/api/logement-ai/enhance-description`;
    const body = { text: description };

    return this.http.post<any>(url, body).pipe(
      timeout(15000),
      map((res) => {
        if (res?.corrected && res.corrected.trim() && res.corrected.trim() !== description) {
          console.log('[Enhance] ✅ Correction Groq réussie');
          return res.corrected.trim();
        }
        return this.advancedLocalCorrection(description);
      }),
      catchError((err) => {
        console.warn('[Enhance] Proxy Groq échoué, fallback local', err);
        return of(this.advancedLocalCorrection(description));
      })
    );
  }

  private advancedLocalCorrection(text: string): string {
    if (!text) return text;

    let corrected = text.toLowerCase();
    
    // Corrections avancées avec contexte tunisien
    const corrections = [
      // Fautes d'orthographe courantes
      { pattern: /\bzamie(s?)\b/g, replacement: 'ami$1' },
      { pattern: /\bvenez\b/g, replacement: 'venez' },
      { pattern: /\bcest\b/g, replacement: "c'est" },
      { pattern: /\btres\b/g, replacement: 'très' },
      { pattern: /\bplan\b/g, replacement: 'appartement' },
      { pattern: /\bpom\b/g, replacement: 'appartement' },
      { pattern: /\bplain\b/g, replacement: 'plat' },
      { pattern: /\bbon\b/g, replacement: 'bon' },
      { pattern: /\bjoli\b/g, replacement: 'joli' },
      
      // Améliorations grammaticales
      { pattern: /\bun appartement tres\b/g, replacement: 'un appartement très' },
      { pattern: /\bappartement avec\b/g, replacement: 'appartement avec' },
      { pattern: /\blogement spacieux\b/g, replacement: 'logement spacieux' },
      
      // Nettoyage et ponctuation
      { pattern: /!!!+/g, replacement: '!' },
      { pattern: /\s{2,}/g, replacement: ' ' },
      { pattern: /\s+([.!?])/g, replacement: '$1' },
      { pattern: /([.!?])\s*([a-z])/g, replacement: '$1 $2' }
    ];

    // Appliquer toutes les corrections
    corrections.forEach(correction => {
      corrected = corrected.replace(correction.pattern, correction.replacement);
    });

    // Améliorations contextuelles
    corrected = corrected.replace(/appartement tres joli/g, 'appartement très joli');
    corrected = corrected.replace(/logement avec/g, 'Logement avec');
    
    // Capitalisation appropriée
    corrected = corrected.replace(/^(.)/, (match) => match.toUpperCase());
    corrected = corrected.replace(/([.!?]\s*)(.)/g, (match, p1, p2) => p1 + p2.toUpperCase());

    return corrected.trim();
  }

  private enhancedLocalCorrection(text: string): string {
    if (!text) return text;

    let corrected = text;
    
    // Corrections simples et efficaces
    corrected = corrected.replace(/\bvenez les zamies\b/gi, 'venez les amis');
    corrected = corrected.replace(/\bzamies\b/gi, 'amis');
    corrected = corrected.replace(/\bcest\b/gi, "c'est");
    corrected = corrected.replace(/\btres\b/gi, 'très');
    corrected = corrected.replace(/\bplan\b/gi, 'appartement');
    corrected = corrected.replace(/\bpom\b/gi, 'appartement');
    corrected = corrected.replace(/\bplain\b/gi, 'plat');
    
    // Améliorations de style
    corrected = corrected.replace(/!!!+/g, '!');
    corrected = corrected.replace(/\s{2,}/g, ' ');
    
    // Nettoyage final
    corrected = corrected.trim();
    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }

    return corrected;
  }

  // Vérifie la similarité entre deux textes (sécurité)
  private calculateSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/);
    const words2 = text2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    return commonWords.length / Math.max(words1.length, words2.length);
  }
}
