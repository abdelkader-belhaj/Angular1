# 🔌 APIs Externes (Stripe, LanguageTool, Nominatim, Gemini)

## 📍 OÙ SONT-ELLES UTILISÉES?

### 🟢 **STRIPE** (Paiements)
**Lieu:** Frontend → Composant paiement + Backend service  
**Fichier Frontend:** `src/app/homePage/checkout-payment/checkout-payment.component.ts`  
**Fichier Backend:** `springLooking-main/src/main/java/.../payment/StripeService.java`

**Configuration:** `src/environments/environment.ts`
```typescript
stripePublishableKey: 'pk_test_51TMy63...'  // Clé de TEST
stripeBackendBaseUrl: 'http://localhost:4242'
```

**Fonctionnement:**
```
1. Utilisateur clique "Payer"
2. Frontend appelle: stripe.confirmCardPayment(clientSecret)
3. Stripe API valide la carte
4. Backend reçoit: POST /api/payments/confirm
5. Backend appelle Stripe API: createChargeSecret()
6. Paiement confirmé ✅
```

---

### 🟠 **NOMINATIM** (OpenStreetMap - Géolocalisation)
**Lieu:** Frontend → Composant création logement  
**Fichier:** `src/app/hebergeur/hebergeur-logement-create/hebergeur-logement-create.component.ts`

**API URL:** `https://nominatim.openstreetmap.org/reverse`

**Fonctionnement:**
```
1. Utilisateur clique "Obtenir ma position actuelle"
2. GPS récupère: latitude=36.8, longitude=10.1
3. Frontend appelle Nominatim:
   GET https://nominatim.openstreetmap.org/reverse?lat=36.8&lon=10.1&format=jsonv2
4. Nominatim retourne: {"display_name": "Tunis, Tunisie", "address": {...}}
5. Frontend auto-complète ville + adresse ✅
```

**Logs Console:**
```javascript
// Filter: [Geocoding]
[Geocoding] Appel Nominatim: https://nominatim.openstreetmap.org/reverse?...
[Geocoding] ✅ Réponse Nominatim: {display_name: "Tunis", ...}
[Geocoding] Ville finale: Tunisie
[Geocoding] Adresse finale: 123 Rue Main, Tunis, Tunisie
```

**Sécurité:** ✅ GRATUIT + AUCUNE clé API requise

---

### 🔵 **LANGUAGETOOL** (Correction Grammaticale)
**Lieu:** Frontend → Bouton "✨ Corriger & Embellir"  
**Fichier:** `src/app/services/accommodation/ai-price-prediction.service.ts`

**API URL:** `https://api.languagetool.org/v2/check`

**Fonctionnement:**
```
1. Utilisateur clique "✨ Corriger & Embellir"
2. Description envoyée: "Ceci est un logement magnifik"
3. Frontend appelle LanguageTool:
   POST https://api.languagetool.org/v2/check
   Body: {text: "Ceci est un logement magnifik", language: "fr"}
4. LanguageTool retourne:
   {matches: [{message: "magnifik → magnifique", ...}]}
5. Frontend affiche description corrigée ✅
```

**Logs Console:**
```javascript
// Filter: [Enhance]
[Enhance] Lancement de la correction avec: Ceci est un logement magnifique...
[Enhance] ✅ Texte amélioré: Ceci est un magnifique logement avec...
[Enhance] Description corrigée avec succès
```

**Sécurité:** ✅ GRATUIT + AUCUNE clé API requise

---

### 🟡 **GEMINI AI** (Intelligence Artificielle)
**Lieu:** Frontend → Correction texte + Prédiction prix  
**Fichier:** `src/app/services/accommodation/ai-price-prediction.service.ts`

**Configuration:** `src/environments/environment.ts`
```typescript
geminiApiKey: 'sk-xxx-xxx'  // À remplir avec ta clé personnelle
```

**Fonctionnement:**
```
Option 1 - Correction Texte (si clé Gemini configurée):
1. Utilisateur clique "✨ Corriger & Embellir"
2. Description envoyée à Gemini
3. Gemini retourne description améliorée
4. Frontend affiche le texte corrigé ✅

Option 2 - Prédiction de Prix:
1. Utilisateur remplit les champs (location, capacité, etc)
2. Données envoyées à Gemini
3. Gemini utilise un modèle IA pour prédire le prix
4. Frontend affiche prix suggéré ✅
```

**Logs Console:**
```javascript
// Filter: [Enhance]
[Enhance] Utilisant Gemini pour la correction...
[Enhance] ✅ Réponse Gemini reçue
[Enhance] Prix prédit: 75 DT par nuit
```

**ATTENTION - Sécurité:**
⚠️ Cette clé est **PERSONNELLE** et ne doit **PAS** être pushée sur Git
```bash
# .gitignore protège ceci:
src/environments/environment.ts  # ← Fichier LOCAL, non commité
```

---

## 📋 TABLEAU RÉCAPITULATIF

| API | Type | Clé Requise? | Coût | Utilisée Pour | Logs |
|-----|------|-------------|------|----------------|------|
| **Stripe** | Paiement | ✅ pk_test_xxx | 💳 2.9% + 0.30€ | Paiements | N/A |
| **Nominatim** | Géoloc | ❌ GRATUIT | 🆓 0€ | Reverse geocoding | [Geocoding] |
| **LanguageTool** | Texte | ❌ GRATUIT | 🆓 0€ | Correction grammaire | [Enhance] |
| **Gemini AI** | IA | ✅ sk-xxx | 💰 Pay-as-you-go | Correction + Prix | [Enhance] |

---

## 🔐 OÙ SONT LES CLÉS API?

### ✅ Fichiers PROTÉGÉS (pas de secrets)
```
springLooking-main/
  └── src/main/resources/
      ├── application.properties           ← Base de données MySQL
      └── application-prod.properties      ← Config production
```
**Statut:** ✅ Sûr - Déjà pushé, peut être écrasé

---

### ⚠️ Fichiers SENSIBLES (clés personnelles)
```
clone_1/
  └── src/environments/
      ├── environment.ts                   ← ⚠️ LOCAL - Clés personnelles
      ├── environment.prod.ts             ← À configurer sur serveur
      └── environment.example.ts          ← Template (aucune clé)
```

**Status:** ⚠️ Protected par `.gitignore` - Ne pas commiter!

---

## 🚀 COMMENT CONFIGURER LES APIS?

### 1️⃣ **NOMINATIM + LANGUAGETOOL** (Gratuit, aucune config)
✅ Déjà fonctionnels!  
```bash
# Rien à faire - APIs publiques
```

---

### 2️⃣ **STRIPE** (Clés de test disponibles)
```typescript
// src/environments/environment.ts
export const environment = {
  stripePublishableKey: 'pk_test_51TMy63ENjl9nFxR...',  // ← Clé de TEST
  stripeBackendBaseUrl: 'http://localhost:4242'
};
```
**Statut:** ✅ Clés de test déjà configurées

---

### 3️⃣ **GEMINI** (Optionnel - pour IA)
```typescript
// src/environments/environment.ts
export const environment = {
  geminiApiKey: 'sk-xxx-xxx'  // ← À REMPLIR avec ta clé
};
```

**Comment obtenir?**
1. Va sur: https://console.cloud.google.com/
2. Crée un projet Google Cloud
3. Active l'API Gemini
4. Génère une clé API
5. Copie-colle dans `environment.ts`

**IMPORTANT:** ⚠️ Ne pas commiter cette clé!

---

## 📊 FLUX COMPLET DES APIs

```
┌──────────────────────────────────────────────────────────────┐
│ UTILISATEUR dans le navigateur (localhost:4200)             │
└──────────────────────────────────────────────────────────────┘
                           ↓
┌──────────────────────────────────────────────────────────────┐
│ FRONTEND ANGULAR (clone_1)                                  │
│                                                              │
│ 1️⃣ Créer logement → appelle hebergeur-logement-create      │
│ 2️⃣ Clic "Obtenir ma position" → GPS → Nominatim API      │
│ 3️⃣ Clic "✨ Corriger" → LanguageTool API OU Gemini API   │
│ 4️⃣ Remplit formulaire → valide → envoie au Backend       │
│ 5️⃣ Clic "Payer" → Stripe API                             │
└──────────────────────────────────────────────────────────────┘
        ↓              ↓                ↓              ↓
┌─────────────┐ ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
│  NOMINATIM  │ │LANGUAGETOOL │ │    GEMINI    │ │   STRIPE     │
│ (OpenStreetMap)  │ (Free)  │ │    (Paid)    │ │  (Payment)   │
│             │ │             │ │              │ │              │
│ Reverse     │ │ Correction  │ │ Correction + │ │ Traitement   │
│ Geocoding   │ │ grammaire   │ │ Prédiction   │ │ paiement     │
└─────────────┘ └─────────────┘ └──────────────┘ └──────────────┘
        ↓              ↓                ↓              ↓
┌──────────────────────────────────────────────────────────────┐
│ BACKEND SPRING BOOT (springLooking-main)                   │
│                                                              │
│ - Reçoit données du formulaire (POST /api/logements)       │
│ - Valide données                                            │
│ - Appelle Stripe pour paiements (selon besoin)            │
│ - Enregistre logement en base de données                   │
└──────────────────────────────────────────────────────────────┘
        ↓
┌──────────────────────────────────────────────────────────────┐
│ BASE DE DONNÉES MySQL (localhost:3306)                      │
│ Database: lookingbdv01                                      │
│                                                              │
│ - INSERT INTO logement (nom, prix, latitude, longitude)     │
│ - INSERT INTO reservation (date, utilisateur, logement)     │
│ - INSERT INTO paiement (stripe_id, montant, date)          │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 POUR TES COLLÈGUES

### "Quelles APIs externes utilise le projet?"
```
1. NOMINATIM (Géolocalisation)     - Gratuit ✅
2. LANGUAGETOOL (Correction texte)  - Gratuit ✅
3. GEMINI (IA)                      - Payant (optionnel)
4. STRIPE (Paiements)               - Payant (actif)
```

### "Comment configurer une nouvelle API?"

**Étape 1: Ajouter la clé dans environment.ts**
```typescript
export const environment = {
  apiBaseUrl: 'http://localhost:8080',
  geminiApiKey: 'sk-xxx',           // ← Clé de la nouvelle API
  stripePublishableKey: 'pk_test_xxx'
};
```

**Étape 2: Créer un service Angular**
```typescript
// src/app/services/my-new-api.service.ts
@Injectable()
export class MyNewApiService {
  constructor(private http: HttpClient) {}
  
  callApi(data: any): Observable<Response> {
    return this.http.post('https://api.exemple.com/endpoint', data);
  }
}
```

**Étape 3: Utiliser dans un composant**
```typescript
this.myNewApiService.callApi(data).subscribe({
  next: (response) => console.log('✅ Succès:', response),
  error: (err) => console.error('❌ Erreur:', err)
});
```

---

## ✅ CHECKLIST

- ✅ Nominatim = Gratuit, pas de config
- ✅ LanguageTool = Gratuit, pas de config
- ✅ Stripe = Clés de test déjà configurées
- ✅ Gemini = Optionnel, à remplir si tu veux l'IA
- ✅ Clés protégées par `.gitignore`
- ✅ Backend peut être pushé sans risque
- ✅ Aucune information sensible ne sera écrasée par git

---

## 🚀 Prêt à utiliser!

Toutes les APIs externes sont documentées et configurées:
- ✅ Nominatim → Géolocalisation
- ✅ LanguageTool → Correction texte (fallback gratuit)
- ✅ Gemini → IA (optionnel)
- ✅ Stripe → Paiements

**Tes collègues peuvent maintenant:**
1. Lire cette doc
2. Comprendre chaque API
3. Ajouter/modifier des APIs sans risque
4. Pusher le code Spring Boot sans crainte 🎉

