# ⚙️ Configuration & Sécurité API

## 📁 Fichiers Importants

### Frontend (Angular)

#### 🔐 Sécurité - `src/app/services/auth.interceptor.ts`
```
Ajoute automatiquement le JWT à TOUS les appels API
Authorization: Bearer YOUR_JWT_TOKEN
(Si token existe dans localStorage['auth_token'])
```

#### 🌐 API - `src/app/services/accommodation/categorie.service.ts`
```
- getCategories()          → GET /api/categories (PUBLIC)
- createCategorie()        → POST /api/categories (PROTÉGÉ)
- updateCategorie(id)      → PUT /api/categories/{id} (PROTÉGÉ)
- deleteCategorie(id)      → DELETE /api/categories/{id} (PROTÉGÉ)
- clearCache()             → Efface le cache local
```

#### 📍 Géolocalisation - `src/app/hebergeur/hebergeur-logement-create/`
```
- getLocation()                    → GPS navigateur
- reverseGeocodeCoordinates()      → Nominatim API (ville/adresse)
- onCoordinatesChange()            → Déclenche le geocoding
```

#### ✍️ Correction Texte - `src/app/services/accommodation/ai-price-prediction.service.ts`
```
- enhanceDescription()             → LanguageTool API
- predictBasePrice()               → Prédiction IA
```

---

### Backend (Spring Boot)

#### 🔒 Sécurité - `springLooking-main/src/main/java/tn/hypercloud/security/SecurityConfig.java`
```java
// Routes PUBLIQUES (sans JWT)
- GET  /api/categories
- GET  /api/logements
- GET  /api/logements/public
- POST /api/auth/login

// Routes PROTÉGÉES (avec JWT)
- POST   /api/categories (ADMIN/HEBERGEUR)
- PUT    /api/categories/{id} (ADMIN/HEBERGEUR)
- DELETE /api/categories/{id} (ADMIN/HEBERGEUR)
- POST   /api/logements (HEBERGEUR)
```

#### 💾 Database - `src/main/resources/application.properties`
```properties
spring.datasource.url=jdbc:mysql://localhost:3306/lookingbdv01
spring.datasource.username=root
spring.datasource.password=
spring.jpa.hibernate.ddl-auto=update
```

---

## 🔑 Variables d'Environnement

### Développement
**Fichier:** `src/environments/environment.ts` (LOCAL, non commité)

```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  geminiApiKey: 'sk-xxx',        // Ta clé personnelle (non commité)
  stripePublishableKey: 'pk_test_xxx',  // Clé de test
  stripeBackendBaseUrl: 'http://localhost:4242'
};
```

### Production
**Fichier:** `src/environments/environment.prod.ts` (À remplir sur serveur)

```typescript
export const environment = {
  production: true,
  apiBaseUrl: process.env['API_BASE_URL'],        // https://api.lookingapp.com
  geminiApiKey: process.env['GEMINI_API_KEY'],    // Clé du serveur
  stripePublishableKey: process.env['STRIPE_KEY'],
  stripeBackendBaseUrl: process.env['STRIPE_BACKEND']
};
```

---

## 📋 Checklist: Avant de Pusher

- [ ] `.gitignore` protège `environment.ts`
- [ ] Aucun secret en dur dans le code (clés API, tokens, etc)
- [ ] Logs détaillés pour le débugage (`[CategorieService]`, `[Geocoding]`, etc)
- [ ] Validation frontend ET backend
- [ ] Routes publiques testées sans authentification
- [ ] Routes protégées testées avec JWT token
- [ ] CORS configuré correctement
- [ ] Pas d'erreurs TypeScript: `ng build`

---

## 🚀 Déploiement

### 1️⃣ Build Production
```bash
ng build --configuration production
# → Génère dist/clone_1/
```

### 2️⃣ Déployer Frontend
- **Heroku:** `git push heroku main`
- **Netlify:** Upload le dossier `dist/`
- **AWS S3:** Upload les fichiers statiques

### 3️⃣ Configurer Variables d'Env
```bash
# Heroku
heroku config:set API_BASE_URL=https://api.lookingapp.com
heroku config:set GEMINI_API_KEY=sk-xxx
heroku config:set STRIPE_KEY=pk_live_xxx

# Netlify (dans .env fichier déployé)
API_BASE_URL=https://api.lookingapp.com
GEMINI_API_KEY=sk-xxx
```

### 4️⃣ Backend + DB
```bash
# Déployer Spring Boot
# → Heroku, AWS, DigitalOcean, etc

# MySQL Database
# → Utiliser service cloud (AWS RDS, etc)
```

---

## 🆘 Debug Rapide

### API ne répond pas?
```bash
# Vérifier backend
curl http://localhost:8080/api/categories

# Logs frontend (F12 Console)
# Filter: [CategorieService]
```

### Catégories vides?
```bash
# Vérifier DB
mysql> SELECT * FROM categorie;

# Vérifier backend startup logs
mvn spring-boot:run | grep -i "categorie\|error"
```

### Token JWT invalide?
```bash
# DevTools Console
localStorage.getItem('auth_token')

# Decoder: https://jwt.io
```

---

## 📚 Documentation

- **API Endpoints:** `API_DOCUMENTATION.md`
- **Pour Contribuer:** `CONTRIBUTING.md`
- **Guide de Debug:** `DEBUGGING_GUIDE.md`
- **Ce fichier:** `SECURITY_CONFIG.md`

---

## 🤝 Support Collègues

Questions fréquentes:
1. **"Comment ajouter une nouvelle API?"**
   → Voir `CONTRIBUTING.md` section "Ajouter une API"

2. **"Comment déboguer les logs?"**
   → Voir `DEBUGGING_GUIDE.md`

3. **"Mes clés API sont en sécurité?"**
   → Oui! Elles sont dans `.gitignore` et non commités ✅

4. **"Comment tester en production?"**
   → Variables d'env du serveur (Heroku, AWS, etc)

---

**N'oublie pas de lire les autres fichiers de doc! 📖**

