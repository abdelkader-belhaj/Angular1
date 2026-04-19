# 🎯 Guide Complet d'Intégration Stripe - Transport Course

## **📋 Table du contenu**

1. [Clés API Stripe](#clés-api-stripe)
2. [Backend Java/Spring](#backend-javaspring)
3. [Frontend Angular](#frontend-angular)
4. [Intégration du workflow de paiement](#intégration-workflow)
5. [Test Mode](#test-mode)
6. [Dépannage](#dépannage)

---

## **🔑 Clés API Stripe**

### Obtenir vos clés

1. Créez un compte sur [Stripe Dashboard](https://dashboard.stripe.com/register)
2. Allez à **Developers → API Keys**
3. Copiez les clés en mode **TEST** (commencent par `sk_test_` et `pk_test_`)
   - **Secret Key** (`sk_test_...`): ⚠️ JAMAIS dans le front-end
   - **Publishable Key** (`pk_test_...`): OK pour le front-end

### Configuration des clés

```
sk_test_51234567890...       # Backend (application.properties)
pk_test_abcdefghijkl...      # Frontend (stripe-payment.config.ts)
whsec_test_1234567890...     # Webhooks (future implémentation)
```

---

## **⚙️ Backend Java/Spring**

### 1️⃣ Ajouter dépendance Stripe

**Fichier: `pom.xml`**

```xml
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>24.13.0</version>
</dependency>
```

### 2️⃣ Configurer les clés

**Fichier: `application.properties`**

```properties
stripe.api.key=sk_test_YOUR_SECRET_KEY_HERE
stripe.publishable.key=pk_test_YOUR_PUBLISHABLE_KEY_HERE
stripe.webhook.secret=whsec_test_YOUR_WEBHOOK_SECRET_HERE
```

### 3️⃣ Créer les DTO

**Fichier: `PaymentIntentResponseDto.java`**

```java
@Data
@Builder
public class PaymentIntentResponseDto {
    private String clientSecret;
    private String paymentIntentId;
    private double montant;
    private double montantCommission;
    private double montantNet;
    private Long paiementId;
    private Long courseId;
}
```

**Fichier: `ConfirmPaymentRequestDto.java`**

```java
@Data
public class ConfirmPaymentRequestDto {
    private Long courseId;
    private String paymentIntentId;
}
```

### 4️⃣ Créer le service Stripe

**Fichier: `StripePaymentService.java`** (voir fichier fourni en temp/)

Points clés:

- `createPaymentIntent()`: Crée un PaymentIntent Stripe
- `confirmPayment()`: Finalise le paiement après Stripe
- `cancelPaymentIntent()`: Annule en cas d'erreur

### 5️⃣ Créer le contrôleur

**Fichier: `StripePaymentController.java`** (voir fichier fourni en temp/)

Endpoints:

```
POST   /hypercloud/stripe/payment-intent/{courseId}
       → Crée un PaymentIntent (frontend appelle avant paiement)

POST   /hypercloud/stripe/confirm-payment
       → Confirme le paiement (frontend appelle après succès Stripe)

DELETE /hypercloud/stripe/cancel-payment/{courseId}
       → Annule le paiement (en cas d'erreur)
```

---

## **🎨 Frontend Angular**

### 1️⃣ Charger Stripe SDK

**Fichier: `src/index.html`**

```html
<!doctype html>
<html lang="fr">
  <head>
    ...
    <!-- Stripe SDK -->
    <script src="https://js.stripe.com/v3/"></script>
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
```

### 2️⃣ Configurer les clés

**Fichier: `stripe-payment.config.ts`**

```typescript
export const STRIPE_CONFIG = {
  publicKey: 'pk_test_YOUR_PUBLISHABLE_KEY_HERE',
  environment: 'test',
};
```

### 3️⃣ Créer le service Angular

**Fichier: `stripe-payment.service.ts`** (déjà créé)

Utilisation:

```typescript
// Étape 1: Créer PaymentIntent
this.stripeService.createPaymentIntent(courseId).subscribe(response => {
  // response.clientSecret à utiliser pour confirmer
});

// Étape 2: Configurer formulaire
await this.stripeService.setupPaymentForm('card-element');

// Étape 3: Confirmer paiement
const result = await this.stripeService.confirmPaymentWithCard(paymentIntentResponse);

// Étape 4: Confirmer au backend
this.stripeService.confirmPaymentBackend({
  courseId: courseId,
  paymentIntentId: paymentIntentId
}).subscribe(...);
```

### 4️⃣ Créer le composant

**Fichier: `stripe-payment.component.ts`** (déjà créé)
**Fichier: `stripe-payment.component.html`** (déjà créé)
**Fichier: `stripe-payment.component.css`** (déjà créé)

### 5️⃣ Enregistrer dans le module

**Fichier: `app.module.ts` ou `TransportModule`**

```typescript
import { FormsModule } from '@angular/forms';
import { StripePaymentComponent } from './components/stripe-payment.component';

@NgModule({
  declarations: [
    StripePaymentComponent,
    // autres composants
  ],
  imports: [
    CommonModule,
    FormsModule, // ← Pour ngModel
    // autres imports
  ],
})
export class TransportModule {}
```

### 6️⃣ Ajouter à la route

**Fichier: `app-routing.module.ts` ou `transport-routing.module.ts`**

```typescript
const routes: Routes = [
  {
    path: 'payment',
    component: StripePaymentComponent,
    // Optionnel: route de paiement dédiée
  },
  // OU intégrer directement dans le composant de fin de course:
  {
    path: 'course/:id',
    component: ActiveCourseComponent, // qui affiche StripePaymentComponent
  },
];
```

---

## **🔗 Intégration Workflow**

### Deux architectures possibles:

#### **Option 1: Composant modal/dialog** (Recommandé)

```typescript
// Dans active-course.component.ts
showPaymentModal() {
  this.showPayment = true;
  this.paymentCourseId = this.activeCoursId;
}

// Template:
<app-stripe-payment
  *ngIf="showPayment"
  [courseId]="paymentCourseId"
></app-stripe-payment>
```

#### **Option 2: Route dédiée**

```typescript
// Après fin de course
this.router.navigate(['/transport/payment'], {
  queryParams: { courseId: courseId },
});
```

### Flow complet:

```
1. ✅ Course complétée
   ↓
2. API POST /courses/{id}/complete
   - Crée PaiementTransport en PENDING
   - Retourne courseId
   ↓
3. 💳 Affiche <app-stripe-payment [courseId]="id">
   ↓
4. Service POST /hypercloud/stripe/payment-intent/{courseId}
   - Backend crée PaymentIntent Stripe
   - Retourne clientSecret
   ↓
5. 🎨 Affiche formulaire Stripe (carte)
   ↓
6. 👤 Utilisateur entre données, clique "Payer"
   ↓
7. 🔐 confirmPaymentWithCard()
   - Crée PaymentMethod à partir de la carte
   - Confirme PaymentIntent côté Stripe
   - Stripe retourne paymentIntent.status = "succeeded"
   ↓
8. 📡 confirmPaymentBackend()
   - POST /hypercloud/stripe/confirm-payment
   - Backend marque PaiementTransport à COMPLETED
   ↓
9. ✅ Redirects vers page de succès
```

---

## **🧪 Test Mode**

### Cartes de test Stripe

| Type         | Numéro              | CVC | Date  |
| ------------ | ------------------- | --- | ----- |
| ✅ Réussi    | 4242 4242 4242 4242 | 424 | 12/26 |
| ❌ Échoué    | 4000 0000 0000 0002 | 424 | 12/26 |
| ⚠️ 3D Secure | 4000 0025 0000 3155 | 424 | 12/26 |

### Tester le flow:

1. Démarrer le backend Spring
2. Démarrer Angular (`npm start`)
3. Naviguer vers `/transport/payment?courseId=1`
4. Utiliser une carte de test
5. Vérifier les logs backend et frontend
6. Vérifier Stripe Dashboard → Payments

---

## **🚨 Dépannage**

### Erreur: "Stripe not defined"

```
❌ ReferenceError: Stripe is not defined
```

**Solution:**

- Vérifiez que Stripe SDK est chargé dans `index.html`
- Regardez la console du navigateur (F12 → Network)
- Vérifiez que CDN n'est pas bloqué par uBlock/AdBlock

### Erreur: "Invalid API Key"

```
❌ Invalid API Key provided
```

**Solution:**

- Vérifiez que la clé `sk_test_...` est dans `application.properties`
- Vérifiez qu'elle n'a pas de caractères supplémentaires
- Vérifiez que c'est bien la **Secret Key**, pas la Publishable Key

### Erreur: "Cannot POST /hypercloud/stripe/..."

```
❌ 404 Not Found - Cannot POST /hypercloud/stripe/payment-intent/1
```

**Solution:**

- Vérifiez que `StripePaymentController` existe
- Vérifiez que c'est annoté avec `@RestController` et `@RequestMapping`
- Vérifiez que le port backend est correct dans Angular (`ApiService`)

### Erreur: "clientSecret is required"

```
❌ Card.confirmCardPayment - clientSecret is required
```

**Solution:**

- Vérifiez que `setupPaymentForm()` a été appelé
- Vérifiez que `paymentDetails` contient `clientSecret`
- Vérifiez les logs du backend

### La carte affiche une bordure vide

```
❌ ID card-element not found
```

**Solution:**

- Vérifiez que le template a un `<div id="card-element"></div>`
- Vérifiez que `setupPaymentForm()` est appelé APRÈS que le DOM soit rendus
- Ajoutez un délai: `setTimeout(() => setupPaymentForm(), 100)`

---

## **📊 Architecture complète**

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND ANGULAR                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ① stripe-payment.component.ts                          │
│     ├─ loadPaymentIntent() → Backend API                │
│     ├─ setupPaymentForm() → Instancie Stripe Elements   │
│     ├─ confirmPaymentWithCard() → Stripe SDK           │
│     └─ confirmPaymentBackend() → Backend API            │
│                                                           │
│  ② stripe-payment.service.ts                            │
│     └─ Wrapper Stripe SDK + HTTP calls                  │
│                                                           │
│  ③ Config: stripe-payment.config.ts                     │
│     └─ Clés API + Settings visuels                      │
│                                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                      STRIPE API                          │
├─────────────────────────────────────────────────────────┤
│  ① PaymentIntent créé ← createPaymentIntent()              │
│  ② Client confirme paiement ← confirmCardPayment()         │
│  ③ Statut retourné → "succeeded"                          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                   BACKEND JAVA/SPRING                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ① StripePaymentController                              │
│     ├─ POST /payment-intent/{courseId}                  │
│     ├─ POST /confirm-payment                            │
│     └─ DELETE /cancel-payment/{courseId}                │
│                                                           │
│  ② StripePaymentService                                 │
│     ├─ createPaymentIntent()                            │
│     ├─ confirmPayment()                                 │
│     └─ cancelPaymentIntent()                            │
│                                                           │
│  ③ Database: PaiementTransport                          │
│     ├─ montantTotal                                     │
│     ├─ montantCommission                                │
│     ├─ statut (PENDING → COMPLETED)                     │
│     └─ methode (CARD)                                   │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## **✅ Checklist d'implémentation**

- [ ] Clés Stripe obtenues et enregistrées
- [ ] Dépendance Stripe ajoutée à `pom.xml`
- [ ] `application.properties` configuré
- [ ] DTOs créés (`PaymentIntentResponseDto`, `ConfirmPaymentRequestDto`)
- [ ] `StripePaymentService.java` créé
- [ ] `StripePaymentController.java` créé
- [ ] Stripe SDK chargé dans `index.html`
- [ ] `stripe-payment.config.ts` créé avec clé publique
- [ ] `stripe-payment.service.ts` créé
- [ ] `stripe-payment.component.*` créés (ts, html, css)
- [ ] Composant déclaré dans le module
- [ ] Route configurée (ou intégré dans composant existant)
- [ ] Tests avec cartes de test Stripe
- [ ] Gestion d'erreur en place
- [ ] Logs configurés pour déboguer
