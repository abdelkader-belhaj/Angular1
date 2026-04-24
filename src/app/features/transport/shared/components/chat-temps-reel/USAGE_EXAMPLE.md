/\*\*

- EXEMPLE D'UTILISATION - CHAT DANS COURSE-ACTIVE
- ================================================
-
- Fichier: src/app/features/transport/courses/client/course-active/course-active.component.html
-
- Ajouter cette section au template (ex. dans un mat-tab-group):
  \*/

// HTML EXEMPLE
const htmlExample = `

<div class="course-content-wrapper">
  
  <!-- Onglets d'infos de course -->
  <mat-tab-group>
    
    <!-- Onglet 1: Détails de course -->
    <mat-tab>
      <ng-template mat-tab-label>
        <mat-icon>location_on</mat-icon>
        <span>Détails du Trajet</span>
      </ng-template>
      
      <div class="tab-content">
        <!-- Votre contenu de course existant -->
        <app-course-details [course]="course"></app-course-details>
      </div>
    </mat-tab>
    
    <!-- Onglet 2: CHAT EN TEMPS RÉEL -->
    <mat-tab>
      <ng-template mat-tab-label>
        <mat-icon>chat_bubble</mat-icon>
        <span>Chat avec le Chauffeur</span>
      </ng-template>
      
      <div class="tab-content chat-tab">
        <app-chat-temps-reel
          [courseId]="course?.idCourse!"
          [recipientName]="course?.chauffeur?.utilisateur?.username || 'Chauffeur'"
          [recipientRole]="'CHAUFFEUR'"
        ></app-chat-temps-reel>
      </div>
    </mat-tab>
    
    <!-- Onglet 3: Évaluation -->
    <mat-tab>
      <ng-template mat-tab-label>
        <mat-icon>star</mat-icon>
        <span>Évaluer le Chauffeur</span>
      </ng-template>
      
      <div class="tab-content">
        <!-- Formulaire d'évaluation existant -->
        <div *ngIf="course?.statut === courseStatus.COMPLETED && !evaluationDone">
          <app-evaluation-form 
            [course]="course"
            (onSubmit)="evaluerChauffeur()"
          ></app-evaluation-form>
        </div>
        <div *ngIf="evaluationDone">
          <p>✅ Merci pour votre évaluation!</p>
        </div>
      </div>
    </mat-tab>
    
  </mat-tab-group>
  
</div>
`;

// CSS POUR LA MISE EN PAGE
const cssExample = `
/_ src/app/features/transport/courses/client/course-active/course-active.component.css _/

.course-content-wrapper {
padding: 16px;
}

mat-tab-group {
margin-top: 16px;
}

.tab-content {
padding: 16px;
min-height: 300px;
}

.tab-content.chat-tab {
padding: 0;
background: transparent;
}

app-chat-temps-reel {
display: block;
height: 600px;
/_ ou max-height: 600px; _/
}

/_ Responsive _/
@media (max-width: 768px) {
.course-content-wrapper {
padding: 8px;
}

.tab-content {
padding: 8px;
}

app-chat-temps-reel {
height: 400px;
}
}
`;

/\*\*

- TYPESCRIPT - NE RIEN AJOUTER!
-
- Le composant chat est standalone et n'a besoin d'aucune configuration
- dans le composant parent (course-active.component.ts).
-
- Il gère tout automatiquement:
- - Chargement de l'historique
- - Connexion WebSocket
- - Envoi/réception de messages
- - Authentification (récupère depuis AuthService)
    \*/

/\*\*

- PROPRIÉTÉS DISPONIBLES (optionnelles)
-
- Si vous voulez intégrer dans un autre conteneur (pas mat-tab):
  \*/
  const otherExample = `
  <!-- Option 1: Modal/Dialog -->
  <mat-dialog-container>
    <h2 mat-dialog-title>Chat avec le chauffeur</h2>

  <mat-dialog-content>
    <app-chat-temps-reel
      [courseId]="activeCourse.idCourse"
      [recipientName]="activeCourse.chauffeur.utilisateur.username"
      [recipientRole]="'CHAUFFEUR'"
    ></app-chat-temps-reel>
  </mat-dialog-content>
  
  <mat-dialog-actions align="end">
    <button mat-button [mat-dialog-close]="true">Fermer</button>
  </mat-dialog-actions>
</mat-dialog-container>

<!-- Option 2: Card -->
<mat-card>
  <mat-card-header>
    <mat-card-title>💬 Chat</mat-card-title>
  </mat-card-header>
  
  <mat-card-content>
    <app-chat-temps-reel
      [courseId]="course.idCourse"
      [recipientRole]="'CHAUFFEUR'"
    ></app-chat-temps-reel>
  </mat-card-content>
</mat-card>

<!-- Option 3: Sidebar -->
<div class="course-layout">
  <div class="main-content">
    <!-- Carte + détails -->
  </div>
  
  <div class="sidebar">
    <app-chat-temps-reel
      [courseId]="courseId"
      [recipientName]="'Chauffeur'"
      [recipientRole]="'CHAUFFEUR'"
    ></app-chat-temps-reel>
  </div>
</div>
`;
