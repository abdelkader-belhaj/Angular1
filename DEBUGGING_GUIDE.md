# 🔍 Guide de Débugage - LookingApp

## Console Logs (F12)

Nous avons ajouté des **logs détaillés** pour chaque fonctionnalité. Ouvre DevTools (F12) et filtre par tag:

### 1️⃣ **[CategorieService]** - Chargement des catégories
```javascript
// Filter: [CategorieService]

Logs affichés:
[CategorieService] Récupération des catégories depuis le backend...
[CategorieService] ✅ Réponse du backend: [...]
[CategorieService] Nombre de catégories reçues: 3
[CategorieService] Retournant les catégories du cache  // 2e appel
```

**Signification:**
- ✅ Réponse = catégories chargées avec succès
- ⚠️ 0 catégories = vérifier backend

---

### 2️⃣ **[Geolocation]** - GPS du navigateur
```javascript
// Filter: [Geolocation]

Logs affichés:
[Geolocation] Demande de position GPS...
[Geolocation] ✅ Position obtenue - lat: 36.806508 lon: 10.181447
[Geolocation] ❌ Erreur: PermissionDenied  // Si utilisateur refuse
```

**Signification:**
- ✅ Position obtenue = Geocoding va démarrer
- ❌ Erreur = Vérifier les permissions du navigateur

---

### 3️⃣ **[Geocoding]** - Reverse Geocoding (Nominatim)
```javascript
// Filter: [Geocoding]

Logs affichés:
[Geocoding] Appel Nominatim: https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=36.806508&lon=10.181447&...
[Geocoding] ✅ Réponse Nominatim: {display_name: "Tunis, Tunisie", ...}
[Geocoding] Ville finale: Tunisie, Région, Tunis
[Geocoding] Adresse finale: 123 Rue Main, Tunis, Tunisie
[Geocoding] ✅ Succès
```

**Signification:**
- ✅ Succès = Ville et adresse auto-complétées
- ❌ Erreur = API Nominatim indisponible

---

### 4️⃣ **[Enhance]** - Correction Grammaticale (LanguageTool)
```javascript
// Filter: [Enhance]

Logs affichés:
[Enhance] Lancement de la correction avec: Ceci est un logement magnifique...
[Enhance] ✅ Texte amélioré: Ceci est un magnifique logement avec...
[Enhance] Description corrigée avec succès
```

**Signification:**
- ✅ Texte amélioré = Correction appliquée
- ❌ Erreur = LanguageTool indisponible

---

### 5️⃣ **[Validation]** - Avant d'envoyer le logement
```javascript
// Filter: [Validation]

Logs affichés:
[Validation] Erreurs: {}  // Vide = validation OK
[Validation] Erreurs: {gps: "Position GPS obligatoire...", nom: "Nom obligatoire..."}
```

**Signification:**
- {} = Tous les champs OK, prêt à envoyer
- {...} = Erreurs détaillées à corriger

---

## 🔧 Tester les Endpoints

### 1️⃣ GET Catégories (PUBLIC)
```bash
curl http://localhost:8080/api/categories

# Réponse attendue:
# [
#   {"idCategorie": 13, "nomCategorie": "Appartement", ...},
#   {"idCategorie": 15, "nomCategorie": "Villa", ...}
# ]
```

### 2️⃣ POST Créer un Logement (PROTÉGÉ)
```bash
# D'abord, LOGIN pour obtenir un token:
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"hebergeur@test.com","password":"12345678"}'

# Réponse: {"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}

# Puis, CRÉER logement avec le token:
curl -X POST http://localhost:8080/api/logements \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "nom": "Mon logement",
    "description": "Un magnifique logement...",
    "idCategorie": 13,
    "prixNuit": 50,
    "capacite": 2,
    "latitude": 36.8,
    "longitude": 10.1,
    "ville": "Tunis",
    "adresse": "123 Rue Main"
  }'
```

---

## 🚨 Erreurs Courantes & Solutions

### ❌ "Aucune catégorie trouvée"
```javascript
// Console montre:
[CategorieService] Nombre de catégories reçues: 0

// ✅ Solutions:
1. Vérifie que le backend tourne: http://localhost:8080/api/categories
2. Regarde [CategorieService] logs pour voir l'erreur
3. Si erreur réseau = vérifier CORS dans SecurityConfig.java
```

### ❌ "Position GPS impossible à déterminer"
```javascript
// Console montre:
[Geolocation] ❌ Erreur: PermissionDenied

// ✅ Solutions:
1. Autorise le navigateur à utiliser la géolocalisation
   - Chrome: 🔒 Paramètres → Confidentialité → Géolocalisation
   - Firefox: 🔒 about:preferences → Confidentialité → Permissions
2. Ou rentre manuellement latitude/longitude
3. Vérifie que tu es sur HTTPS en production (HTTP ne marche pas!)
```

### ❌ "Erreur lors de la correction (✨ Corriger & Embellir)"
```javascript
// Console montre:
[Enhance] ❌ Erreur: fetch error

// ✅ Solutions:
1. Vérifie la connexion internet (LanguageTool est une API externe)
2. Essaie d'actualiser: F5
3. C'est juste un fallback, la description s'envoie quand même
```

### ❌ "401 Unauthorized"
```bash
curl -X POST http://localhost:8080/api/logements \
  -d '{"nom":"test"}'

# ❌ Erreur: 401 Unauthorized
# Raison: Pas de JWT token

# ✅ Solution:
curl -X POST http://localhost:8080/api/logements \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{"nom":"test"}'
```

---

## 📊 Vérifier Backend & DB

### Backend tourne?
```bash
# Terminal:
cd springLooking-main
mvn spring-boot:run

# ✅ Si tu vois: "Started Application in X seconds"
# Backend est OK!

# ❌ Si erreur: vérifier les logs
```

### Base de données?
```sql
-- MySQL Console:
SELECT * FROM categorie;

-- Doit afficher:
-- id_categorie | nom_categorie
-- 13           | Appartement
-- 15           | Villa
-- 18           | Chalet
```

---

## 🎯 Checklist de Debug

Avant de demander de l'aide, vérifie:

- [ ] Console (F12) ouverte avec les bons logs
- [ ] Backend tourne: `mvn spring-boot:run`
- [ ] Frontend tourne: `ng serve`
- [ ] Base de données accessible: `mysql lookingbdv01`
- [ ] Pas d'erreurs CORS dans la Console
- [ ] Token JWT valide si c'est une route protégée
- [ ] `environment.ts` configuré avec les bonnes clés

---

## 💡 Tips

**Pour voir les requêtes HTTP complètes:**
1. DevTools → Network (avant d'effectuer l'action)
2. Cherche la requête (`categories`, `logements`, etc)
3. Clique dessus → Onglet "Request/Response"

**Pour tester sans collègues:**
Utilise **Postman** ou **Insomnia**:
1. Import: `API_DOCUMENTATION.md`
2. Ajoute les endpoints
3. Teste avec/sans token

---

**Besoin d'aide? Demande aux collègues! 🤝**

