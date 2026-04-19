# ⚡ DÉMARRAGE RAPIDE - Stripe Integration

## **ÉTAPE 1: Clés Stripe (5 min)**

```
1. Aller à: https://dashboard.stripe.com/register
2. Créer un compte
3. Aller à: Developers → API Keys
4. Copier les clés en mode TEST

Clés obtenues:
- sk_test_51234... (Secret - Backend)
- pk_test_67890... (Publique - Frontend)
```

---

## **ÉTAPE 2: Backend Spring (10 min)**

### 2.1 Ajouter dépendance

```xml
<!-- pom.xml -->
<dependency>
    <groupId>com.stripe</groupId>
    <artifactId>stripe-java</artifactId>
    <version>24.13.0</version>
</dependency>
```

### 2.2 Configurer clés

```properties
# application.properties
stripe.api.key=sk_test_YOUR_SECRET_KEY
stripe.publishable.key=pk_test_YOUR_PUBLISHABLE_KEY
stripe.webhook.secret=whsec_test_YOUR_WEBHOOK_SECRET
```

### 2.3 Copier fichiers Java

Copier depuis `C:\temp\` vers votre backend:

- `StripePaymentService.java` → `service/transport/`
- `StripePaymentController.java` → `controller/transport/`
- `PaymentIntentResponseDto.java` → `dto/transport/`
- `ConfirmPaymentRequestDto.java` → `dto/transport/`

### 2.4 Redémarrer backend

```bash
mvn spring-boot:run
```

---

## **ÉTAPE 3: Frontend Angular (10 min)**

### 3.1 Ajouter Stripe SDK

```html
<!-- src/index.html - dans <head> -->
<script src="https://js.stripe.com/v3/"></script>
```

### 3.2 Configurer clés

```typescript
// src/app/features/transport/core/services/stripe-payment.config.ts
export const STRIPE_CONFIG = {
  publicKey: 'pk_test_67890...', // ← Votre clé publique
  environment: 'test',
};
```

### 3.3 Déclarer dans module

```typescript
// transport.module.ts
import { FormsModule } from '@angular/forms';
import { StripePaymentComponent } from './components/stripe-payment.component';

@NgModule({
  declarations: [StripePaymentComponent],
  imports: [FormsModule], // ← IMPORTANT
})
export class TransportModule {}
```

### 3.4 Démarrer Angular

```bash
npm start
```

---

## **ÉTAPE 4: Intégrer au workflow**

### Option A: Modal après fin de course

```typescript
// active-course.component.ts
completeCourse() {
  this.courseService.completeCourse(this.courseId).subscribe(() => {
    this.showPaymentForm = true; // Affiche <app-stripe-payment>
  });
}
```

### Option B: Route dédiée

```typescript
// Routes
{
  path: 'payment',
  component: StripePaymentComponent
}

// Usage
this.router.navigate(['/transport/payment'], {
  queryParams: { courseId: 1 }
});
```

### Template

```html
<app-stripe-payment [courseId]="courseId"></app-stripe-payment>
```

---

## **ÉTAPE 5: Tester**

### Cartes de test

```
Succès: 4242 4242 4242 4242
Échoué: 4000 0000 0000 0002
CVC: 424
Date: 12/26
```

### Test flow

1. Naviguer vers une course
2. Compléter la course
3. Formulaire de paiement s'affiche
4. Entrer une carte de test
5. Cliquer "Payer"
6. ✅ Succès ou ❌ Erreur

---

## **🐛 Si ça ne marche pas**

| Erreur                              | Cause                  | Solution                                       |
| ----------------------------------- | ---------------------- | ---------------------------------------------- |
| "Stripe not defined"                | SDK pas chargé         | Vérifier `src/index.html` → Actualiser la page |
| "Invalid API Key"                   | Mauvaise clé backend   | Copier la clé `sk_test_` depuis Dashboard      |
| "Cannot POST /hypercloud/stripe..." | Controller pas trouvé  | Redémarrer backend + vérifier classe existe    |
| Carte affiche boîte vide            | DOM pas prêt           | Le `<div id="card-element"></div>` existe?     |
| "clientSecret is required"          | PaymentIntent non créé | Vérifier les logs backend                      |

---

## **📊 Files créés**

### À utiliser immédiatement:

- ✅ `stripe-payment.config.ts` - Config
- ✅ `stripe-payment.service.ts` - Service
- ✅ `stripe-payment.component.ts` - Composant
- ✅ `stripe-payment.component.html` - Template
- ✅ `stripe-payment.component.css` - Styles

### À copier du backend:

- ⬜ `StripePaymentService.java` (C:\temp\)
- ⬜ `StripePaymentController.java` (C:\temp\)
- ⬜ `PaymentIntentResponseDto.java` (C:\temp\)
- ⬜ `ConfirmPaymentRequestDto.java` (C:\temp\)

### Documentation:

- 📖 `STRIPE_INTEGRATION_GUIDE.md` - Complet
- 💡 `STRIPE_EXAMPLES.md` - 10 exemples

---

## **✅ Checklist**

- [ ] Clés Stripe obtenues
- [ ] `pom.xml` mis à jour
- [ ] `application.properties` configuré
- [ ] 4 fichiers Java copiés
- [ ] `src/index.html` a le SDK Stripe
- [ ] `stripe-payment.config.ts` a la clé publique
- [ ] Module déclare `StripePaymentComponent`
- [ ] Module importe `FormsModule`
- [ ] Backend redémarré
- [ ] Angular recompilé (`npm start`)
- [ ] Test avec carte 4242...
- [ ] ✅ Succès!

---

## **🔗 Liens utiles**

- [Stripe Dashboard](https://dashboard.stripe.com)
- [Stripe Docs](https://stripe.com/docs)
- [Test Cards](https://stripe.com/docs/testing)
- [PaymentIntent Docs](https://stripe.com/docs/payments/payment-intents)

---

## **Support**

En cas de problème:

1. Vérifier les logs backend (console Spring)
2. Vérifier les logs frontend (F12 → Console)
3. Consulter `STRIPE_INTEGRATION_GUIDE.md` section Dépannage
4. Vérifier que les clés `sk_test_` et `pk_test_` sont correctes

Bon paiement! 🚀
