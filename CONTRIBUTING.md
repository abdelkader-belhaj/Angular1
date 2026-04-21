# 🏠 LookingApp - Plateforme de Réservation d'Hébergement

## 👋 Bienvenue Collègues!

Ce projet est une **plateforme Angular + Spring Boot** pour réserver des hébergements.

---

## 🚀 Démarrage Rapide

### 1️⃣ **Clone le repo**
```bash
git clone https://github.com/your-repo/clone_1.git
cd clone_1
```

### 2️⃣ **Configure les variables d'environnement (DEV)**
```bash
cp src/environments/environment.example.ts src/environments/environment.ts
```

Ouvre `src/environments/environment.ts` et ajoute tes clés:
```typescript
export const environment = {
  production: false,
  apiBaseUrl: 'http://localhost:8080',
  geminiApiKey: 'sk-xxx-xxx',  // Ajoute ta clé pour correction texte
  stripePublishableKey: 'pk_test_xxx',
  stripeBackendBaseUrl: 'http://localhost:4242'
};
```

> 💡 **Tip:** Ce fichier n'est **PAS** commité (voir `.gitignore`), donc tes clés restent locales! ✅

### 3️⃣ **Installe les dépendances**
```bash
npm install
```

### 4️⃣ **Lance le backend (Spring Boot)**
```bash
cd ../springLooking-main
mvn spring-boot:run -DskipTests
```

Backend démarre sur: `http://localhost:8080`

### 5️⃣ **Lance le frontend (Angular) - Terminal séparé**
```bash
cd clone_1
ng serve
```

Frontend démarre sur: `http://localhost:4200`

### 6️⃣ **Accède à l'app**
```
http://localhost:4200
```

---

## 📚 Architecture

### Frontend (Angular 17)
```
src/
  ├── app/
  │   ├── services/              ← Services API (CategorieService, LogementService, etc)
  │   ├── hebergeur/             ← Pages pour les hébergeurs
  │   ├── dashbord/              ← Pages admin
  │   └── homePage/              ← Pages publiques
  ├── environments/              ← Config dev/prod
  └── assets/                    ← Images, styles
```

### Backend (Spring Boot)
```
springLooking-main/
  ├── src/main/java/tn/hypercloud/
  │   ├── security/              ← JWT, sécurité
  │   ├── controller/            ← Endpoints API
  │   ├── service/               ← Logique métier
  │   └── repository/            ← Base de données
  └── pom.xml                    ← Dépendances Maven
```

---

## 🔐 API: Routes Publiques vs Protégées

### 🟢 PUBLIQUES (Sans authentification)
```
GET  /api/categories              → Récupère toutes les catégories
GET  /api/logements               → Récupère tous les logements
GET  /api/logements/public        → Logements disponibles
```

**Service:** `src/app/services/accommodation/categorie.service.ts`
```typescript
// Pas besoin de token JWT
this.categorieService.getCategories().subscribe(data => {
  console.log('Catégories:', data);
});
```

### 🔴 PROTÉGÉES (Avec JWT)
```
POST   /api/categories            → Créer catégorie (ADMIN/HEBERGEUR)
PUT    /api/categories/{id}       → Modifier catégorie
DELETE /api/categories/{id}       → Supprimer catégorie
POST   /api/logements             → Créer logement (HEBERGEUR)
```

**Le token JWT est AUTOMATIQUEMENT ajouté** grâce à `AuthInterceptor`:
```typescript
// Pas besoin de l'ajouter manuellement!
this.logementService.createLogement(data).subscribe(...);
```

> 📖 **Lire plus:** `API_DOCUMENTATION.md`

---

## 🛠️ Guide de Développement

### Ajouter une API

1. **Dans le Backend** (`springLooking-main/src/main/java/.../controller/`)
```java
@PostMapping("/api/logements")
@PreAuthorize("hasAnyRole('HEBERGEUR', 'ADMIN')")  // ← Force l'authentification
public ResponseEntity<Logement> createLogement(@RequestBody LogementRequest req) {
    // Logique...
}
```

2. **Dans le Frontend** (`src/app/services/...`)
```typescript
createLogement(data: LogementRequest): Observable<Logement> {
  return this.http.post<Logement>(this.apiUrl, data);
  // ↑ Token JWT ajouté auto par AuthInterceptor
}
```

3. **Dans le Composant** (`src/app/.../...component.ts`)
```typescript
this.logementService.createLogement(this.formData).subscribe({
  next: (logement) => console.log('✅ Créé:', logement),
  error: (err) => console.error('❌ Erreur:', err)
});
```

---

## 🐛 Debug

### Voir les logs API
Ouvre DevTools (F12) et filtre dans la **Console**:
```
[CategorieService]    ← Logs des catégories
[Geocoding]           ← Logs de géolocalisation
[Enhance]             ← Logs de correction texte
[Validation]          ← Logs de validation
```

### Tester une API avec Postman/cURL

```bash
# GET - Pas d'auth
curl http://localhost:8080/api/categories

# POST - Avec auth
curl -X POST http://localhost:8080/api/logements \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Mon logement"}'
```

---

## 📋 Fonctionnalités Principales

### ✅ Déjà Implémentées
- ✅ Authentification JWT (login/register)
- ✅ Catégories (créer/modifier/supprimer)
- ✅ Logements (créer/lister/détails)
- ✅ Géolocalisation GPS + Reverse Geocoding
- ✅ Correction grammaticale (LanguageTool)
- ✅ Prédiction de prix (IA)
- ✅ Réservations + Paiement (Stripe)

### 🚧 À Faire
- [ ] Tests unitaires
- [ ] Tests d'intégration E2E
- [ ] Pagination sur les listes
- [ ] Filtres avancés
- [ ] Push notifications

---

## 🆘 Problèmes Courants

### ❌ "Catégories introuvables"
**Solution:** Le service récupère SANS token JWT d'abord, puis AVEC.
```bash
curl http://localhost:8080/api/categories
# Doit retourner: [{"idCategorie":13, "nomCategorie":"Appartement", ...}]
```

### ❌ "401 Unauthorized" sur POST /api/logements
**Solution:** Vérifie le token JWT dans localStorage:
```javascript
// DevTools Console
localStorage.getItem('auth_token')  // Doit afficher un token valide
```

### ❌ "CORS Error"
**Solution:** Le backend a CORS configuré, mais vérifie les headers:
```bash
# Vérifier depuis le backend
# springLooking-main/src/main/java/.../SecurityConfig.java
```

---

## 📖 Ressources Utiles

- **API Doc:** `API_DOCUMENTATION.md`
- **Angular Docs:** https://angular.io/docs
- **Spring Boot Docs:** https://spring.io/projects/spring-boot
- **JWT Tokens:** https://jwt.io
- **LanguageTool API:** https://languagetool.org/

---

## 🤝 Comment Contribuer

1. Crée une **branche** pour ta feature:
   ```bash
   git checkout -b feature/ma-fonctionnalite
   ```

2. **Commite** avec des messages clairs:
   ```bash
   git commit -m "✨ Ajoute la géolocalisation"
   ```

3. **Push** ta branche:
   ```bash
   git push origin feature/ma-fonctionnalite
   ```

4. Crée une **Pull Request** sur GitHub

---

## 📞 Support

Besoin d'aide ? Vérifie:
1. La console du navigateur (F12)
2. Les logs backend (`mvn spring-boot:run`)
3. La documentation API
4. Pose une question aux collègues! 👥

---

**Bonne dev! 🚀**

