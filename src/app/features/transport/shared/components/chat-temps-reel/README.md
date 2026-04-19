# Chat en Temps Réel - Composant Angular

## 📋 Vue d'ensemble

Le composant `ChatTempsReelComponent` offre une expérience de messaging en temps réel entre clients et chauffeurs avec:

- ✅ **Historique des messages** avec chargement automatique
- ✅ **WebSocket temps réel** via STOMP/SockJS
- ✅ **REST fallback** si WebSocket échoue
- ✅ **Indicateurs de statut** (envoyé/livré/lu)
- ✅ **Auto-scroll** vers les nouveaux messages
- ✅ **Responsive design** mobile-first
- ✅ **Scroll smooth** et animations fluides
- ✅ **Gestion d'erreurs** gracieuse
- ✅ **Authentification** intégrée

## 🚀 Installation

### 1. Vérifier les imports

Le composant est déjà déclaré dans `SharedModule`:

```typescript
// shared.module.ts
import { ChatTempsReelComponent } from "./components/chat-temps-reel/chat-temps-reel.component";

@NgModule({
  declarations: [ChatTempsReelComponent],
  exports: [ChatTempsReelComponent],
})
export class SharedModule {}
```

### 2. Importer SharedModule dans votre feature module

```typescript
// courses.module.ts
import { SharedModule } from "@shared/shared.module";

@NgModule({
  imports: [SharedModule],
})
export class CoursesModule {}
```

## 💻 Utilisation

### Usage basique

```html
<app-chat-temps-reel [courseId]="course.idCourse" [recipientName]="'Chauffeur'" [recipientRole]="'CHAUFFEUR'"></app-chat-temps-reel>
```

### Une avec tous les paramètres

```html
<app-chat-temps-reel [courseId]="activeTransport.idCourse" [recipientName]="activeTransport.chauffeur.utilisateur.username" [recipientRole]="'CHAUFFEUR'"></app-chat-temps-reel>
```

## 📊 API du Composant

### Inputs

| Propriété       | Type                    | Requis | Défaut      | Description                                 |
| --------------- | ----------------------- | ------ | ----------- | ------------------------------------------- |
| `courseId`      | `number`                | ✅     | -           | ID de la course (utilisé pour requêtes API) |
| `recipientName` | `string`                | ❌     | "Chauffeur" | Nom du destinataire affiché dans le header  |
| `recipientRole` | `'CLIENT'\|'CHAUFFEUR'` | ❌     | "CHAUFFEUR" | Rôle du destinataire                        |

### Outputs

Aucun output direct. Le composant gère tout en interne via services.

## 🔧 Architecture interne

### Services utilisés

1. **MessageTransportService** - Gestion des messages
   - `getChatHistory(courseId)` - Récupère l'historique
   - `sendMessageViaRest(courseId, senderId, contenu)` - Envoie par REST
   - `onMessageReceived(message)` - Reçoit du WebSocket
   - `markAsRead(messageId)` - Marque comme lu

2. **WebsocketService** - Connexion temps réel
   - `subscribe(topic, callback)` - S'abonne à un topic
   - Automatiquement géré par le composant

3. **AuthService** - Authentification
   - `getCurrentUser()` - Récupère l'utilisateur actuel

4. **NotificationService** - Notifications utilisateur
   - Affiche erreurs et confirmations

## 🌐 Endpoints Backend requis

```
GET  /hypercloud/courses/{courseId}/messages
POST /hypercloud/courses/{courseId}/messages
POST /messages/{messageId}/read

WebSocket: ws://localhost:8080/ws-transport
Topic: /topic/course/{courseId}/chat
```

## 🎨 Styles et Customisation

### Variables CSS disponibles

Le composant utilise des styles inline. Pour customiser:

```css
/* Override les variables */
::ng-deep .chat-container {
  max-height: 800px;
}

::ng-deep .chat-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

::ng-deep .message.sent .message-content {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

### Responsive breakpoints

- **Desktop**: 75% max-width pour les messages
- **Tablet (768px)**: 90% max-width
- **Mobile (480px)**: 95% max-width

## 📝 Logging et Debugging

Tous les logs utilisent le préfixe `[CHAT]`:

```javascript
[CHAT] Historique reçu: 15 messages
[CHAT] Message WebSocket reçu
[CHAT] Envoi message: {...}
[CHAT] Message envoyé avec succès
[CHAT] Erreur envoi message: Network error
```

Ouvrez la console (F12) pour déboguer.

## ⚠️ Gestion d'erreurs

Le composant gère gracieusement:

- ✅ Pas de connexion WebSocket → REST fallback
- ✅ Message échoue → Rétention du texte, notification d'erreur
- ✅ Utilisateur non authentifié → Erreur bloquante claire
- ✅ Course non trouvée → Avertissement
- ✅ Réseau timeout → Retry automatique

## 🧪 Tests

Inclus:

- `chat-temps-reel.component.spec.ts` - Tests unitaires du composant
- `message-transport.service.spec.ts` - Tests du service

Exécuter les tests:

```bash
npm run test -- --include='**/chat-temps-reel*'
```

## 🚨 Troubleshooting

### Aucun message n'apparaît

1. Vérifier que `courseId` est passé au composant
2. Ouvrir la console (F12) et chercher `[CHAT]` logs
3. Vérifier que `/courses/{courseId}/messages` retourne les données
4. Vérifier que l'utilisateur est authentifié

### WebSocket reconnecting infiniment

1. Vérifier que le backend est actif
2. Vérifier que `/ws-transport` est disponible
3. Vérifier les logs backend pour les erreurs d'authentification
4. Vérifier CORS settings

### Le bouton "Envoyer" est disabled

1. Vérifier que le texte n'est pas vide
2. Vérifier que l'utilisateur est authenticié (`currentUserId != null`)
3. Vérifier la console pour les erreurs

### Design cassé sur mobile

Le composant est responsive. Si le design est cassé:

1. Vérifier le viewport meta tag: `<meta name="viewport" content="width=device-width, initial-scale=1">`
2. Vérifier que pas de CSS global qui override
3. Vérifier les media queries custom

## 📚 Exemples d'intégration

### Dans un Tab group (recommandé)

```html
<mat-tab-group>
  <mat-tab label="💬 Chat">
    <app-chat-temps-reel [courseId]="course.idCourse"></app-chat-temps-reel>
  </mat-tab>
</mat-tab-group>
```

### Dans une Card

```html
<mat-card>
  <mat-card-title>Chat</mat-card-title>
  <mat-card-content>
    <app-chat-temps-reel [courseId]="courseId"></app-chat-temps-reel>
  </mat-card-content>
</mat-card>
```

### Dans un Dialog

```typescript
this.dialog.open(ChatDialogComponent, {
  data: { courseId: this.course.idCourse },
});
```

## 🔐 Sécurité

- ✅ Authentification requise (via AuthService)
- ✅ CourseId validé par le backend
- ✅ WebSocket token-based (Bearer JWT)
- ✅ Pas de données sensibles en logs
- ✅ XSS protected (Angular sanitization)

## 📦 Dépendances

```json
{
  "@angular/common": "^15.0.0",
  "@angular/forms": "^15.0.0",
  "@stomp/stompjs": "^7.0.0",
  "rxjs": "^7.0.0"
}
```

## 📞 Support

Pour les issues avec le composant:

1. Vérifier les logs console `[CHAT]`
2. Consulter le fichier `INTEGRATION_GUIDE.md`
3. Consulter le fichier `USAGE_EXAMPLE.md`
4. Vérifier les tests unitaires pour les patterns corrects

---

**Last updated**: April 10, 2026  
**Version**: 1.0.0
