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

  // Gemini API configuration from environment (empty key disables frontend calls)
  private readonly GEMINI_API_KEY = environment.geminiApiKey;
  private readonly API_URL = this.GEMINI_API_KEY
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

    if (!this.API_URL) {
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

    return this.http.post<any>(this.API_URL, body).pipe(
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
   * Corrects and enhances the text of a lodging description using Gemini.
   */
  enhanceDescription(description: string): Observable<string> {
    if (!this.API_URL) {
      return of((description || '').trim());
    }

    const prompt = `Tu es un correcteur/rédacteur professionnel francophone pour des annonces d'hébergement.
Voici le texte original de l'hébergeur : "${description}"

Ta mission stricte :
1. Corriger toutes les fautes d'orthographe, de grammaire, de conjugaison et de ponctuation.
2. Reformuler légèrement pour améliorer la fluidité et le style.
3. Rester TRÈS proche du texte d'origine: même sens, mêmes informations, même intention.
4. Ne rien inventer: n'ajoute aucun équipement, aucun service, aucun chiffre, aucune promesse absente du texte.
5. Ne pas changer le contexte du logement ni le ton global.
6. Conserver une longueur similaire (environ +/- 20%).

IMPORTANT :
- Réponds uniquement avec la version corrigée finale.
- N'ajoute aucun titre, aucun commentaire, aucune explication.`;

    const body = {
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: 0.1
      }
    };

    return this.http.post<any>(this.API_URL, body).pipe(
      map(response => {
        try {
          let correctedText = response.candidates[0].content.parts[0].text;
          // Clean quotes if Gemini wraps it
          correctedText = correctedText.trim().replace(/^["']|["']$/g, '');
          return correctedText;
        } catch (error) {
          throw new Error("L'IA a renvoyé un format illisible.");
        }
      }),
      catchError(() => {
        return of((description || '').trim());
      })
    );
  }
}
