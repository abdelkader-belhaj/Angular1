# 🎯 Guide rapide : où tester le paiement Stripe

## Le bouton de paiement se trouve ICI:

```
1. Ouvrir l'application Angular
   ↓
2. Cliquer sur "Aller à Stays" ou une réservation
   ↓
3. Ouvrir un logement
   ↓
4. EN BAS À DROITE: trouver le bouton "RÉSERVER" (bleu/violet)
   ↓
5. Cliquer sur "RÉSERVER"
   ↓
   → Un formulaire s'ouvre
   ↓
6. Remplir le formulaire:
   - Sélectionner les dates (cliquer sur "Cliquez pour sélectionner")
   - Choisir le nombre de personnes
   ↓
7. ⭐ CLIQUER SUR "CONFIRMER LA RÉSERVATION" (bouton noir en bas)
   
   ← C'EST CE BOUTON QUI DÉCLENCHE LE PAIEMENT STRIPE
```

## Voici ce qui se passe ensuite:

**Après "Confirmer la réservation":**

1. La réservation est créée en base
2. Une redirection automatique vers Stripe Checkout apparaît
3. Tu vois le formulaire de paiement Stripe (page de paiement blanche)

**Pour tester le paiement:**

Utilise cette carte de test Stripe:
```
Numéro:       4242 4242 4242 4242
Expiration:   01/35 (n'importe quelle date future)
CVC:          123 (n'importe quel nombre 3 chiffres)
Code postal:  75001 (n'importe quel code)
Nom:          Test User (n'importe quoi)
```

Clique sur "Payer" ou "Pay" sur la page Stripe.

**Après le paiement:**

Tu es redirigé sur "Mes Réservations" avec un message:
- ✅ "Paiement Stripe confirmé" (succès)
- ou ❌ "Paiement annulé" (si tu as quitté)

---

## ⚠️ Important: vérifier avant de tester

### Étape 0 - Démarrer les services

**Terminal 1** (Stripe backend):
```
npm run stripe:server
```

Attendre que tu vois:
```
Stripe server is running on http://localhost:4242
```

**Terminal 2** (Frontend Angular):
```
npm start
```

Attendre que tu vois:
```
✓ 1 file changed, web pack compilation successful
```

Si Angular propose un autre port (4201 par exemple), c'est OK, clique "Y".

### Étape 1 - Se connecter

L'app ouvre sur http://localhost:4200 (ou le port proposé).

Tu dois être connecté en tant que **CLIENT_TOURISTE** pour réserver.

Si pas de compte, crée-le ou utilise un compte existant avec ce rôle.

### Étape 2 - Chercher le bouton "RÉSERVER"

Une fois sur un logement, scroll vers le bas.

Tu verras une section avec:
- Un gros bouton **violet/bleu** avec écrit "RÉSERVER"
- Ou si prix négocié: "Négocier le prix avec l'Agent IA 🤖"

C'est le point de départ du flux paiement.

---

## Si ça ne marche pas

- ❌ Pas de redirection Stripe?
  → Vérifier que stripe:server affiche "running"
  → Vérifier qu'il y a pas d'erreur dans la console du navigateur (F12)

- ❌ Erreur CORS?
  → Redémarrer npm run stripe:server

- ❌ Pas de formulaire de réservation?
  → Vérifier qu'on est connecté en CLIENT_TOURISTE
  → Vérifier que le logement n'est pas saturé

- ❌ Paiement refusé?
  → Utiliser exactement la carte 4242 4242 4242 4242
  → Ne pas mettre de tirets entre les chiffres
  → CVC: au moins 3 chiffres
