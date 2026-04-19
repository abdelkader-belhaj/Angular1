/\*\*

- GUIDE D'INTÉGRATION - CHAT EN TEMPS RÉEL
- ==========================================
-
- 1.  IMPORT DANS COMPOSANT
- Ajouter dans course-active.component.ts:
-
- import { ChatTempsReelComponent } from '@shared/components/chat-temps-reel/chat-temps-reel.component';
-
- Le composant est déjà importable via SharedModule
-
- 2.  UTILISATION DANS TEMPLATE HTML
-
- Ajouter dans course-active.component.html:
-
- <!-- Tab pour le chat -->
- <mat-tab label="💬 Chat">
-     <ng-template mat-tab-label>
-       <span>Chat</span>
-     </ng-template>
-
-     <app-chat-temps-reel
-       [courseId]="courseId"
-       [recipientName]="course?.chauffeur?.utilisateur?.username || 'Chauffeur'"
-       [recipientRole]="'CHAUFFEUR'"
-     ></app-chat-temps-reel>
- </mat-tab>
-
- 3.  PROPRIÉTÉS DU COMPOSANT
-
- @Input() courseId: number - ID de la course (REQUIRED)
- @Input() recipientName: string - Nom du destinataire ("Chauffeur")
- @Input() recipientRole: 'CLIENT'|'CHAUFFEUR' - Rôle du destinataire
-
- 4.  FEATURES DU CHAT
-
- ✅ Chargement automatique de l'historique
- ✅ Réception temps réel via WebSocket
- ✅ Envoi via REST avec fallback
- ✅ Indicateurs de statut (envoyé/livré/lu)
- ✅ Auto-scroll vers les nouveaux messages
- ✅ Envoi avec Enter (shift+Enter pour nouvelle ligne)
- ✅ Responsive mobile
-
- 5.  BACKEND ENDPOINTS
-
- GET /hypercloud/courses/{courseId}/messages - Historique
- POST /hypercloud/courses/{courseId}/messages - Envoyer message
- POST /messages/{messageId}/read - Marquer comme lu
-
- WebSocket: /ws-transport
- Topics:
-     - /topic/course/{courseId}/chat                   - Messages broadcast
-     - /queue/user/messages                            - Messages directs (optionnel)
-
- 6.  LOGGING CONSOLE
-
- [CHAT] logs pour déboguer
- Exemples:
-     - [CHAT] Historique reçu: 15 messages
-     - [CHAT] Message WebSocket reçu
-     - [CHAT] Message envoyé via REST
-     - [CHAT] Erreur envoi message
  \*/

// EXEMPLE D'INTÉGRATION COMPLÈTE
import { Component, OnInit } from '@angular/core';
import { ChatTempsReelComponent } from '@shared/components/chat-temps-reel/chat-temps-reel.component';

/\*\*

- Dans course-active.component.ts, ajouter:
  \*/
  example_integration() {
  // Zone des onglets (si pas déjà présent)
  // <mat-tab-group>
  // <mat-tab label="📍 Détails">
  // <!-- Détails de la course -->
  // </mat-tab>
  //  
   // <mat-tab label="💬 Chat">
  // <app-chat-temps-reel
  // [courseId]="course?.idCourse!"
  // [recipientName]="course?.chauffeur?.utilisateur?.username || 'Chauffeur'"
  // [recipientRole]="'CHAUFFEUR'"
  // ></app-chat-temps-reel>
  // </mat-tab>
  //  
   // <mat-tab label="⭐ Évaluer">
  // <!-- Formulaire d'évaluation -->
  // </mat-tab>
  // </mat-tab-group>

// Le chat s'intègre directement - pas de code supplémentaire requis!
}

// STYLING PERSONNALISÉ (optionnel)
/\* Pour intégrer dans un dialog ou modal:

.course-active-chat-container {
display: flex;
flex-direction: column;
height: 100%;
}

app-chat-temps-reel {
flex: 1;
/_ Le composant est responsive _/
}

/_ Customisation du header du chat _/
::ng-deep .chat-header {
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

:::

/\*

- TROUBLESHOOTING
- ===============
-
- Problème: "No messages appearing"
- Solution: Vérifier que:
- - courseId est passé
- - Backend /courses/{courseId}/messages retourne les messages
- - WebSocket est connecté (voir console [CHAT])
-
- Problème: "WebSocket reconnecting..."
- Solution:
- - Vérifier la connexion backend
- - Vérifier log: [CHAT] Message WebSocket reçu
-
- Problème: "Send button disabled"
- Solution:
- - Vérifier que le texte n'est pas vide
- - Vérifier currentUser est authentifié
-
- Problème: "Error: Course ID is required"
- Solution:
- - Vérifier que [courseId] est passé au composant
- - Vérifier que la course existe
    \*/
