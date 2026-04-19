# Guide test paiement Stripe

Ce projet utilise un flux en 2 parties :
- Frontend Angular pour initier le checkout
- Serveur Stripe local (Express) pour creer la session de paiement

## 1) Prerequis

- Node.js installe
- Compte Stripe en mode test
- Fichier .env present a la racine

Contenu minimal de .env :

STRIPE_PORT=4242
FRONTEND_URL=http://localhost:4200
STRIPE_SECRET_KEY=sk_test_xxxxxxxxxxxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxx

## 2) Lancer les services

Dans un terminal 1:

npm run stripe:server

Dans un terminal 2:

npm start

Si le port 4200 est deja utilise, Angular peut proposer un autre port. Dans ce cas,
mettez FRONTEND_URL sur ce port dans .env puis relancez stripe:server.

## 3) Test rapide API paiement

Verifier la sante du serveur Stripe:

Invoke-WebRequest -Uri "http://localhost:4242/api/payments/health" -UseBasicParsing | Select-Object -ExpandProperty Content

Tester la creation de session:

$payload = @{ reservationId = 999; logementId = 1; amountInCents = 1500; currency = 'eur' } | ConvertTo-Json -Compress
$response = Invoke-WebRequest -Method Post -Uri "http://localhost:4242/api/payments/create-checkout-session" -ContentType "application/json" -Body $payload -UseBasicParsing
$response.Content

La reponse doit contenir:
- sessionId
- sessionUrl (url checkout Stripe)

## 4) Test depuis l application

1. Ouvrir l application Angular
2. Aller sur un logement
3. Faire une reservation
4. Verification attendue:
   - Creation reservation
   - Redirection vers Stripe Checkout
5. Utiliser une carte de test Stripe:
   - Numero: 4242 4242 4242 4242
   - Date: n importe quelle date future
   - CVC: 3 chiffres
   - Code postal: n importe lequel
6. Cliquer sur payer
7. Retour automatique sur Mes reservations

## 5) Test du webhook (recommande)

Le webhook est expose sur:
http://localhost:4242/api/payments/webhook

Avec Stripe CLI (si installe):

stripe listen --forward-to localhost:4242/api/payments/webhook

Copier le signing secret whsec fourni par la CLI dans .env:

STRIPE_WEBHOOK_SECRET=whsec_...

Puis relancer:

npm run stripe:server

Dans un autre terminal, declencher un event test:

stripe trigger checkout.session.completed

Le serveur doit logger checkout.session.completed avec sessionId et reservationId.

## 6) Problemes frequents

- Erreur CORS:
  Verifier FRONTEND_URL dans .env et redemarrer stripe:server.

- Pas de redirection checkout:
  Verifier que create-checkout-session renvoie bien sessionUrl.

- Erreur signature webhook:
  Verifier STRIPE_WEBHOOK_SECRET et relancer le serveur.

- Le paiement est accepte mais statut metier non mis a jour:
  Il faut brancher la mise a jour reservation payee dans votre backend metier
  dans le traitement de checkout.session.completed.
