// src/app/features/transport/transport.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { HomeSharedModule } from '../../../homePage/home-shared.module';

// Routing
import { TransportRoutingModule } from './transport-routing.module';

// Shared
import { SharedModule } from '../shared/shared.module';

// Layouts
import { LayoutClientComponent } from '../layouts/layout-client/layout-client.component';
import { LayoutChauffeurComponent } from '../layouts/layout-chauffeur/layout-chauffeur.component';
import { LayoutAgenceComponent } from '../layouts/layout-agence/layout-agence.component';

// Page accueil
import { AccueilTransportComponent } from '../pages/accueil-transport/accueil-transport.component';

// Courses
import { TableauBordChauffeurComponent } from '../courses/chauffeur/tableau-bord-chauffeur/tableau-bord-chauffeur.component';
import { ProfilChauffeurComponent } from '../courses/chauffeur/profil-chauffeur/profil-chauffeur.component';
import { GestionVehiculesComponent } from '../courses/chauffeur/gestion-vehicules/gestion-vehicules.component';
import { DemanderCourseComponent } from '../courses/client/demander-course/demander-course.component';
import { AttenteChauffeurComponent } from '../courses/client/attente-chauffeur/attente-chauffeur.component';
import { CourseActiveComponent } from '../courses/client/course-active/course-active.component';
import { HistoriqueCoursesComponent } from '../courses/client/historique-courses/historique-courses.component';
import { EvaluerCourseComponent } from '../courses/client/evaluer-course/evaluer-course.component';
import { HistoriqueCoursesChauffeurComponent } from '../courses/chauffeur/historique-courses-chauffeur/historique-courses-chauffeur.component';
import { CourseActiveChauffeurComponent } from '../courses/chauffeur/course-active-chauffeur/course-active-chauffeur.component';
import { PortefeuilleChauffeurComponent } from '../courses/chauffeur/portefeuille-chauffeur/portefeuille-chauffeur.component';
import { AttenteConfirmationClientComponent } from '../courses/chauffeur/attente-confirmation-client/attente-confirmation-client.component';
import { ChauffeurSidenavComponent } from '../courses/chauffeur/chauffeur-sidenav/chauffeur-sidenav.component';
import { StatistiquesChauffeurComponent } from '../courses/chauffeur/statistiques-chauffeur/statistiques-chauffeur.component';
import { StripePaymentComponent } from '../core/components/stripe-payment.component';
import { CardPaymentModalComponent } from '../core/components/card-payment-modal/card-payment-modal.component';
import { TransporteurOnboardingComponent } from '../pages/transporteur-onboarding/transporteur-onboarding.component';
@NgModule({
  declarations: [
    LayoutClientComponent,
    LayoutChauffeurComponent,
    LayoutAgenceComponent,
    AccueilTransportComponent,
    TableauBordChauffeurComponent,
    ProfilChauffeurComponent,
    GestionVehiculesComponent,
    DemanderCourseComponent,
    AttenteChauffeurComponent,
    CourseActiveComponent,
    EvaluerCourseComponent,
    HistoriqueCoursesComponent,
    HistoriqueCoursesChauffeurComponent,
    CourseActiveChauffeurComponent,
    PortefeuilleChauffeurComponent,
    StatistiquesChauffeurComponent,
    AttenteConfirmationClientComponent,
    ChauffeurSidenavComponent,
    StripePaymentComponent,
    TransporteurOnboardingComponent,
  ],
  imports: [
    CommonModule,
    HttpClientModule,
    TransportRoutingModule,
    SharedModule,
    HomeSharedModule,
    CardPaymentModalComponent,
  ],
})
export class TransportModule {}
