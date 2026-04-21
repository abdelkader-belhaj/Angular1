# 📚 Documentation des API

## 🔒 Architecture de Sécurité

### Routes Publiques (Sans authentification)
Ces routes sont **accessibles à TOUS** sans token JWT :

```
GET  /api/categories              - Récupère toutes les catégories
GET  /api/categories/{id}         - Récupère une catégorie par ID
GET  /api/logements               - Récupère tous les logements publics
GET  /api/logements/public        - Logements disponibles à la réservation
GET  /api/logements/{id}          - Détails d'un logement
GET  /api/logements/categorie/{id} - Logements par catégorie
```

**Fichier de configuration:** `springLooking-main/src/main/java/tn/hypercloud/security/SecurityConfig.java`

### Routes Protégées (Avec authentification JWT)
Ces routes nécessitent un **token JWT valide** dans l'en-tête :

```
POST   /api/categories             - Créer une catégorie (ADMIN/HEBERGEUR)
PUT    /api/categories/{id}        - Modifier une catégorie (ADMIN/HEBERGEUR)
DELETE /api/categories/{id}        - Supprimer une catégorie (ADMIN/HEBERGEUR)

POST   /api/logements              - Créer un logement (HEBERGEUR)
PUT    /api/logements/{id}         - Modifier un logement (HEBERGEUR)
DELETE /api/logements/{id}         - Supprimer un logement (HEBERGEUR)
```

**Authentification:** Ajouter dans les en-têtes HTTP:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

---

## 🌐 Endpoints Frontend

### Service: `CategorieService`
**Fichier:** `src/app/services/accommodation/categorie.service.ts`

```typescript
// Charge les catégories
getCategories(): Observable<Categorie[]>

// Efface le cache pour forcer un rechargement
clearCache(): void

// Crée une nouvelle catégorie (protégé)
createCategorie(data): Observable<Categorie>

// Modifie une catégorie (protégé)
updateCategorie(id, data): Observable<Categorie>

// Supprime une catégorie (protégé)
deleteCategorie(id): Observable<void>
```

### Service: `LogementService`
**Fichier:** `src/app/services/accommodation/logement.service.ts`

```typescript
// Récupère tous les logements publics
getLogements(): Observable<Logement[]>

// Crée un nouveau logement (protégé)
createLogement(data): Observable<Logement>

// Modifie un logement (protégé)
updateLogement(id, data): Observable<Logement>

// Supprime un logement (protégé)
deleteLogement(id): Observable<void>
```

---

## 🔑 Variables d'Environnement

### Développement
**Fichier:** `src/environments/environment.ts`
```typescript
apiBaseUrl: 'http://localhost:8080',
geminiApiKey: '',  // Vide en dev (utilise LanguageTool fallback)
stripePublishableKey: 'pk_test_...'
```

### Production
**Fichier:** `src/environments/environment.prod.ts`
```typescript
// ⚠️ NE PAS COMMITTER AVEC LES VRAIES CLÉS
// Utiliser les variables d'environnement du serveur:
apiBaseUrl: process.env['API_BASE_URL'],
geminiApiKey: process.env['GEMINI_API_KEY'],
stripePublishableKey: process.env['STRIPE_KEY']
```

---

## 🛡️ Sécurité: Points Clés

### ✅ Ce qui EST protégé
- ✅ Création/Modification/Suppression = JWT obligatoire
- ✅ Données sensibles = variables d'environnement
- ✅ node_modules/ = dans .gitignore
- ✅ Fichiers .env = dans .gitignore

### ⚠️ À faire avant PRODUCTION
- [ ] Configurer CORS correctement (origins autorisés)
- [ ] HTTPS obligatoire (pas HTTP)
- [ ] Vérifier les tokens JWT (durée d'expiration)
- [ ] Rate limiting sur les routes publiques
- [ ] Valider les entrées utilisateur

---

## 🚀 Déploiement

### Sur Heroku / AWS / DigitalOcean
```bash
# 1. Définer les variables d'environnement sur le serveur
heroku config:set API_BASE_URL=https://api.lookingapp.com
heroku config:set GEMINI_API_KEY=sk-xxx
heroku config:set STRIPE_KEY=pk_xxx

# 2. Le frontend prendra automatiquement ces valeurs
environment.prod.ts → process.env['API_BASE_URL']
```

---

## 📋 Checklist pour Collègues

**Si tu rejoins ce projet:**

1. ✅ Clone le repo: `git clone ...`
2. ✅ Installe: `npm install`
3. ✅ Copie les variables d'env:
   ```bash
   cp src/environments/environment.example.ts src/environments/environment.ts
   ```
4. ✅ Ajoute tes clés API locales dans `environment.ts` (fichier local, non commité)
5. ✅ Lance le backend: `mvn spring-boot:run`
6. ✅ Lance le frontend: `ng serve`
7. ✅ Accès: `http://localhost:4200`

---

## 🐛 Debug: Consulter les Logs

Ouvre DevTools (F12) dans le navigateur:
```
Console → Filtre [CategorieService]
Console → Filtre [Geocoding]
Console → Filtre [Enhance]
Console → Filtre [Validation]
```

Chaque opération affiche ses logs en détail pour trouver les problèmes ! 🔍

