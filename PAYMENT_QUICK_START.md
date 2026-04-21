# 💳 Sécurité - Clés API

## ✅ Bonnes pratiques simples:

1. **Fichier `.env`** (non pushé)
   ```
   STRIPE_KEY=pk_test_...
   GEMINI_KEY=sk-...
   ```

2. **Fichier `.gitignore`** (protège .env)
   ```
   .env
   .env.local
   ```

3. **Fichier `.env.example`** (pushé - template)
   ```
   STRIPE_KEY=
   GEMINI_KEY=
   ```

## Collègues qui clonent:
```bash
cp .env.example .env
# Ajouter leurs clés
```

**Résumé:** Clés dans `.env` → Template `.env.example` → Rien ne sera écrasé ✅

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
