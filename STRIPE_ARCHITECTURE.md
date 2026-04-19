# 🎯 Architecture & Diagrammes Stripe

## **Diagramme 1: Flux de paiement**

```
┌─────────────────────────────────────────────────────────────────────┐
│                       CLIENT REACT                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1️⃣ Course complétée                                                │
│  ↓                                                                   │
│  2️⃣ Affiche <app-stripe-payment courseId="123">                   │
│  ↓                                                                   │
│  3️⃣ Service: createPaymentIntent(123)                              │
│      API: POST /hypercloud/stripe/payment-intent/123               │
│  ↓                                                                   │
│  4️⃣ Reçoit: { clientSecret: "pi_test#secret", montant: 50 }       │
│  ↓                                                                   │
│  5️⃣ setupPaymentForm() - Affiche formulaire Stripe                │
│  ↓                                                                   │
│  6️⃣ Utilisateur entre les données de carte                         │
│  ↓                                                                   │
│  7️⃣ Clic "Payer"                                                   │
│  ↓                                                                   │
│  8️⃣ confirmPaymentWithCard(clientSecret, cardElement)              │
│      Stripe.confirmCardPayment()                                    │
│  ↓                                                                   │
│  9️⃣ Stripe valide → "payment_intent.status = succeeded"           │
│  ↓                                                                   │
│  🔟 confirmPaymentBackend(courseId, paymentIntentId)               │
│     API: POST /hypercloud/stripe/confirm-payment                   │
│     Body: { courseId: 123, paymentIntentId: "pi_test_xxx" }        │
│  ↓                                                                   │
│  ✅ Reçoit: { statut: "COMPLETED", datePaiement: "..." }           │
│  ↓                                                                   │
│  ✅ Succès - Redirect vers dashboard                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## **Diagramme 2: Interactions Stripe - Frontend - Backend**

```
┌──────────────────────────┐
│    STRIPE API (Cloud)    │
│  ✓ PaymentIntents        │
│  ✓ Payment Methods        │
│  ✓ Charges                │
└──────────────────────────┘
         ▲      ▲
         │③     │⑥
         │      │
         ├──────┘
         │
    ┌────┴──────────────────────────────────────────────────────────┐
    │                                                                 │
┌───┴──────────────────────────┐             ┌──────────────────────┴┐
│   FRONTEND ANGULAR           │             │  BACKEND SPRING      │
│  ✓ StripePaymentComponent    │             │  ✓ StripeController  │
│  ✓ setupPaymentForm()        │  API①②④⑤  │  ✓ StripeService     │
│  ✓ confirmPaymentWithCard()  │◄────────►  │                      │
│    (appelle Stripe③)         │             │                      │
└──────────────────────────────┘             └──────────────────────┘
         ▲                                             ▲
         │                                             │
         │①②④⑤ HTTP Calls                    Database│
         │  ① createPaymentIntent()          │ PaiementTransport
         │  ② setupPaymentForm()             │ (PENDING→COMPLETED)
         │  ③ confirmCardPayment()           │
         │  ④ confirmPaymentBackend()        │
         │  ⑤ confirmPayment()               │
         │                                    │
    ┌────┴───────────────────────────────────┴────┐
    │                DATABASE                      │
    │   paiementtransport                         │
    │   ├─ id_paiement: 1                         │
    │   ├─ montant_total: 50.00                   │
    │   ├─ montant_commission: 10.00              │
    │   ├─ montant_net: 40.00                     │
    │   └─ statut: COMPLETED                      │
    └─────────────────────────────────────────────┘
```

---

## **Diagramme 3: États du composant de paiement**

```
                        ┌─────────────┐
                        │   'init'    │ (Chargement)
                        └──────┬──────┘
                               │
                    ¡ loadPaymentIntent()
                               │
                    ┌──────────┴──────────────┐
                    │                         │
              ✅ Succès                  ❌ Erreur
                    │                         │
            ┌───────▼──────┐         ┌──────▼────────┐
            │    'form'    │         │   'error'     │
            └───────┬──────┘         └──────▲────────┘
                    │                       ▲
         ¡ onPayClick()              ¡ setState({error})
                    │                       ▲
          ┌─────────▼──────┐               │
          │  'processing'  │               │
          └─────────┬──────┘         ❌ Erreur
                    │                       ▲
     ¡ confirmPaymentWithCard()            │
            Stripe.confirmCardPayment()     │
                    │                       │
        ┌───────────┴──────────┐            │
        │                      │            │
     ✅ succeeded      ❌ failed/pending
        │                      │
        │              setState({error})
        │                      │
 ¡ confirmPaymentBackend()     └────────────┘
        │
        │ ✅ Backend OK
        │
     ┌──▼─────────┐
     │  'success'  │ ──► Redirect
     └─────────────┘
```

---

## **Diagramme 4: Structure de données**

```
FRONTEND - PaymentIntentResponse
{
  "clientSecret": "pi_test#secret_xxx",         ← Pour Stripe
  "paymentIntentId": "pi_test_xxx",              ← ID unique Stripe
  "montant": 50.00,                              ← Client paie
  "montantCommission": 10.00,                    ← Plateforme retient
  "montantNet": 40.00,                           ← Chauffeur reçoit
  "paiementId": 1,                               ← ID DB
  "courseId": 123                                ← Lien course
}

BACKEND - PaiementTransport Entity
{
  idPaiement: 1,
  course: Course@123,
  montantTotal: 50.00,          ← Ce que client paie
  montantCommission: 10.00,     ← Commission plateforme
  montantNet: 40.00,            ← Pour chauffeur
  methode: "CARD",              ← Mode paiement
  statut: "COMPLETED",          ← État
  datePaiement: "2025-04-12...",
  typePaiement: "COURSE"        ← 20% commission automatiqu
}

STRIPE - PaymentIntent
{
  id: "pi_test_xxx",
  client_secret: "pi_test#secret_xxx",
  amount: 5000,                  ← Centimes! (50 TND)
  currency: "tnd",
  status: "succeeded",
  payment_method: "pm_xxx",
  metadata: {
    courseId: "123",
    paiementId: "1",
    chauffeurId: "42"
  }
}
```

---

## **Diagramme 5: Commission calculation**

```
                Client paie 50 TND
                      │
                      ├─────────────┬─────────────┐
                      │             │             │
                      ▼             ▼             ▼
              ┌──────────────┐  ┌──────────┐  ┌─────────┐
              │  Commision   │  │ Chauffeur│  │ Platform│
              │   Chauffeur  │  │   gagne  │  │ retient │
              └──────────────┘  └──────────┘  └─────────┘

              40 TND ──────────►  Chauffeur   (80%)
              10 TND ────────────────────────►  Platform (20%)

              Math (automatique dans @PrePersist):
              commission = montantTotal × 0.20
              net = montantTotal - commission
```

---

## **Diagramme 6: Intégration dans le workflow course**

```
┌─────────────────────────────────────────────────────────────────────┐
│                    COURSE WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  STATUT: PENDING                                                    │
│  ├─ Client crée demande                                            │
│  └─ Matching chauffeur trouvé                                      │
│                           │                                         │
│                           ▼                                         │
│  STATUT: ACCEPTED                                                  │
│  ├─ Chauffeur accepte                                              │
│  └─ Client reçoit assignation                                      │
│                           │                                         │
│                           ▼                                         │
│  STATUT: STARTED                                                   │
│  ├─ Chauffeur arrive au lieu de départ                             │
│  └─ Commence trajet                                                │
│                           │                                         │
│                           ▼                                         │
│  STATUT: IN_PROGRESS                                               │
│  ├─ Trajet en cours                                                │
│  └─ Localisation temps réel                                        │
│                           │                                         │
│                           ▼                                         │
│  STATUT: COMPLETED                                                 │
│  ├─ Chauffeur arrive destination                                   │
│  ├─ End time calculé, prixFinal défini                            │
│  ├─ PaiementTransport créé (montantTotal = prixFinal)             │
│  └─ ► AFFICHE <app-stripe-payment> ◄──┐                          │
│                           │             │                          │
│           ┌───────────────┴─────────────┘                          │
│           │ Suite du paiement Stripe                               │
│           │                                                        │
│           ├─ ① createPaymentIntent() - Backend                    │
│           ├─ ② setupPaymentForm() - Frontend                      │
│           ├─ ③ confirmPaymentWithCard() - Stripe                  │
│           ├─ ④ confirmPaymentBackend() - Backend UPDATE           │
│           │    PaiementTransport.statut = COMPLETED               │
│           └─ ✅ SUCCESS                                           │
│               └─ Redirect vers dashboard                           │
│                                                                       │
│  💾 DATABASE UPDATE:                                                │
│     PaiementTransport.statut: PENDING ────► COMPLETED              │
│     WalletTransaction créée avec montantNet                        │
│     Chauffeur.solde += montantNet                                  │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## **Diagramme 7: Gestion d'erreurs**

```
                        ┌──────────────┐
                        │ Payment Flow │
                        └──────┬───────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
      ┌──────────────┐  ┌─────────────┐  ┌──────────┐
      │ Backend API  │  │  Stripe API │  │  User    │
      │   Error?     │  │   Error?    │  │  Error?  │
      └──────┬───────┘  └─────┬───────┘  └────┬─────┘
             │                │               │
             ▼                ▼               ▼
      ┌──────────────────────────────────────────────┐
      │  Error Handler                              │
      │  ├─ Affiche message user-friendly          │
      │  ├─ Log pour debugging                      │
      │  ├─ Appelle cancelPaymentIntent() si besoin │
      │  └─ Offre "Réessayer" ou "Annuler"         │
      └──────────────────────────────────────────────┘
             │
             ├─ state.step = 'error'
             ├─ state.error = message
             └─ Template affiche <div class="error-state">
```

---

## **Diagramme 8: Sécurité**

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SÉCURITÉ                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  🔴 JAMAIS dans le Frontend                                         │
│     ├─ Clé secrète (sk_test_...)  ← Secret KEY                     │
│     ├─ Données complètes de paiement                              │
│     └─ Informations chauffeur complètes                           │
│                                                                       │
│  🟢 OK dans le Frontend                                             │
│     ├─ Clé publique (pk_test_...)                                  │
│     ├─ clientSecret du PaymentIntent (UUID unique)                │
│     └─ Informations publiques générales                           │
│                                                                       │
│  🔐 Backend fait                                                    │
│     ├─ Utilise Stripe.apiKey = sk_test_... (SECRET)               │
│     ├─ Valide que le PaymentIntent est "succeeded"                │
│     ├─ Marque la transaction en DB                                │
│     ├─ Rend les logs inaccessibles                                │
│     └─ Webhook pour les événements asynchrones                    │
│                                                                       │
│  🛡️ Stripe gère                                                    │
│     ├─ Encodage SSL/TLS                                           │
│     ├─ PCI DSS compliance (données sensibles)                     │
│     ├─ Tokenization de la carte                                   │
│     ├─ Fraude & détection d'anomalies                            │
│     └─ Chiffrement end-to-end                                     │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## **Diagramme 9: States du paiement côté DB**

```
┌──────────────────────────────────────────────────────────────────┐
│                   PaiementTransport States                        │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ① PENDING (Créé)                                                │
│     └─ PaiementTransport créé quand course COMPLETED             │
│        Montant défini = course.prixFinal                         │
│        Commission calc automatiquement (20%)                     │
│        En attente de paiement Stripe                             │
│                                                                   │
│  ② COMPLETED (Succès) ◄─── Boucle de paiement réussie           │
│     └─ confirmPayment() appelé après Stripe "succeeded"          │
│        Paiement confirmé et comptabilisé                        │
│        Commission versée à plateforme                           │
│        Montant net versé au chauffeur                           │
│        Reçu généré                                              │
│                                                                   │
│  ③ REFUNDED (Remboursé)                                          │
│     └─ Client demande remboursement                             │
│        ou erreur durant paiement                                 │
│        Montant retourné au client                               │
│                                                                   │
│  ④ FAILED (Échoué) ◄─── Erreur ou annulation                    │
│     └─ Paiement refusé par Stripe                               │
│        Raison: Carte refusée, expirée, etc.                     │
│        Utilisateur peut réessayer                               │
│                                                                   │
│  TRANSITIONS POSSIBLES:                                          │
│  PENDING ──♡okay♡►  COMPLETED                                  │
│  PENDING ──♡cancel♡►  FAILED                                   │
│  COMPLETED ──♡refund request♡►  REFUNDED                       │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

---

## **Diagramme 10: Vue responsive UI**

```
DESKTOP (>768px)                MOBILE (<768px)
┌──────────────────────┐        ┌──────────────┐
│  💳 PAIEMENT         │        │  💳 PAIEMENT │
├──────────────────────┤        ├──────────────┤
│ Montant: 50 TND      │        │ Montant:     │
│ Commission: 10 TND   │        │   50 TND     │
│ Chauffeur: 40 TND    │        │ (détails)    │
│                      │        │              │
│ Email: [____]  [____]│        │ Email:       │
│ Nom:   [____]        │        │ [___________]│
│                      │        │              │
│ Carte Stripe:        │        │ Carte Stripe │
│ ┌──────────────────┐ │        │ ┌───────────┐│
│ │ [XXXX][XXXX]     │ │        │ │ [XXXXXX]  ││
│ │ Exp: [MM/YY]     │ │        │ │ Exp:[MM] ││
│ │ CVC: [XXX]       │ │        │ │ CVC:[XX] ││
│ │                  │ │        │ └───────────┘│
│ └──────────────────┘ │        │              │
│                      │        │ [Payer]      │
│ [Payer 50 TND]       │        │ [Annuler]    │
│ [Annuler]            │        │              │
│                      │        │ 🔒 Sécurité  │
│ 🔒 Sécurisé Stripe   │        └──────────────┘
└──────────────────────┘
```

---

Ce diagrammes te montre l'architecture complète! Pour plus de détails, consulte:

- `STRIPE_INTEGRATION_GUIDE.md` - Documentation complète
- `STRIPE_EXAMPLES.md` - 10 exemples pratiques
- `STRIPE_QUICK_START.md` - Démarrage rapide
