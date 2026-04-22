import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, catchError, of } from 'rxjs';
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

  // Gemini API configuration from environment
  private readonly GEMINI_API_KEY = environment.geminiApiKey;
  private readonly GEMINI_API_URL = this.GEMINI_API_KEY
    ? `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.GEMINI_API_KEY}`
    : '';

  constructor(private http: HttpClient) { }

  /**
   * Predicts a suggested price using Google Gemini API based on lodging parameters.
   * Asynchronous operation.
   */
  predictPrice(description: string, capacity: number, categoryName: string, equipements: string[] = []): Observable<number> {
    const equipmentBonus = this.getEquipmentBonus(equipements);

    return this.predictBasePrice(description, capacity, categoryName).pipe(
      map((basePrice) => {
        const finalPrice = basePrice + equipmentBonus;
        return Math.round(finalPrice / 5) * 5;
      })
    );
  }

  predictBasePrice(description: string, capacity: number, categoryName: string): Observable<number> {

    if (!this.GEMINI_API_URL) {
      // Local fallback to avoid noisy network failures when Gemini is not configured.
      const base = 70 + Math.max(capacity, 1) * 12;
      return of(Math.round(base / 5) * 5);
    }

    const prompt = `Tu es un expert en évaluation immobilière et touristique en Tunisie.
Je veux que tu estimes un prix PAR NUIT logique pour un logement avec les données suivantes :
- Type de bien : ${categoryName || 'Logement standard'}
- Capacité : ${capacity} personnes
- Description marketing : "${description}"

Règles : Évalue uniquement la base du prix avec le type, la capacité et la description. N'inclus pas les équipements dans ce calcul de base (ils seront ajoutés séparément par l'application). Ajoute de la valeur s'il y a plus de personnes.
IMPORTANT : Je veux UNIQUEMENT et STRICTEMENT un nombre entier renvoyé, représentant le prix optimal en Dinars Tunisiens. Ne dis absolument aucun mot, ni bonjour, ni TND. Juste le chiffre final.`;

    const body = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        // Enforce a stricter format for numerical output
        temperature: 0.2
      }
    };

    return this.http.post<any>(this.GEMINI_API_URL, body).pipe(
      map(response => {
        try {
          const rawText = response.candidates[0].content.parts[0].text;
          // Extract only the numbers in case Gemini still writes some text.
          const numericValue = rawText.replace(/[^0-9]/g, '');
          const price = parseInt(numericValue, 10);
          
           if (isNaN(price) || price < 10) {
             console.warn("L'IA n'a pas renvoyé un format de prix valide :", rawText);
             return 80;
          }

          // Lisser aux 5 dinars près pour un vrai prix commercial
           return Math.round(price / 5) * 5;
        } catch (error) {
          throw new Error("L'IA a renvoyé un format illisible.");
        }
      }),
      catchError(() => {
        const base = 70 + Math.max(capacity, 1) * 12;
        return of(Math.round(base / 5) * 5);
      })
    );
  }

  getEquipmentBonus(equipements: string[] = []): number {
    const selectedEquipements = equipements.filter(Boolean);
    return this.calculateEquipmentBonus(selectedEquipements);
  }

  private calculateEquipmentBonus(equipements: string[]): number {
    return equipements.reduce((sum, name) => {
      const key = this.normalizeEquipmentKey(name);
      return sum + (this.EQUIPMENT_WEIGHTS[key] ?? 0);
    }, 0);
  }

  private normalizeEquipmentKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  /**
   * Simple local fallback: normalize spaces and basic accents only
   */
  private localCorrectDescription(text: string): string {
    if (!text) return text;

    let corrected = text;

    // Normalize multiple spaces
    corrected = corrected.replace(/\s+/g, ' ');

    // Fix spacing around French punctuation
    corrected = corrected.replace(/\s+([.,!?;:])/g, '$1');
    corrected = corrected.replace(/([.,!?;:])\s*/g, '$1 ');

    // Capitalize first letter
    if (corrected.length > 0) {
      corrected = corrected.charAt(0).toUpperCase() + corrected.slice(1);
    }

    return corrected.trim();
  }

  /**
   * Corrects and enhances description using Google Gemini API
   */
  enhanceDescription(description: string): Observable<string> {
    // Fallback if no API key
    if (!this.GEMINI_API_URL) {
      console.warn('[Enhance] No Gemini API key - using local correction');
      return of(this.localCorrectDescription(description));
    }

    const prompt = `Tu es un correcteur professionnel pour des annonces d'hébergement en français.
Corrige UNIQUEMENT les fautes d'orthographe, grammaire, ponctuation et conjugaison.
Reformule légèrement pour plus de fluidité.
IMPORTANT: Ne change pas le sens, n'ajoute aucune information, reste très proche de l'original.
Ne réponds que avec le texte corrigé, rien d'autre.

Texte original: "${description}"`;

    const body = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 1024
      }
    };

    return this.http.post<any>(this.GEMINI_API_URL, body).pipe(
      map(response => {
        try {
          const correctedText = response.candidates[0].content.parts[0].text.trim();
          console.log('[Enhance] ✅ Texte corrigé par Gemini API');
          return correctedText;
        } catch (error) {
          console.warn('[Enhance] Erreur parsing Gemini API');
          return this.localCorrectDescription(description);
        }
      }),
      catchError((err) => {
        console.warn('[Enhance] Gemini API indisponible:', err.message);
        return of(this.localCorrectDescription(description));
      })
    );
  }
}
