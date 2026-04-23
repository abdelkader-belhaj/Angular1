import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeSharedModule } from './homePage/home-shared.module';

import { FooterComponent } from './homePage/footer/footer.component';
import { HomePageComponent } from './homePage/home-page.component';
import { HeroSectionComponent } from './homePage/hero-section/hero-section.component';
import { StaysSectionComponent } from './homePage/stays-section/stays-section.component';
import { MobilitySectionComponent } from './homePage/mobility-section/mobility-section.component';
import { EventsSectionComponent } from './homePage/events-section/events-section.component';
import { MarketplaceSectionComponent } from './homePage/marketplace-section/marketplace-section.component';
import { ChroniclesSectionComponent } from './homePage/chronicles-section/chronicles-section.component';

import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { SideNavComponent } from './dashbord/side-nav/side-nav.component';
import { DashHeaderComponent } from './dashbord/dash-header/dash-header.component';
import { StatsOverviewComponent } from './dashbord/stats-overview/stats-overview.component';
import { BookingsTableComponent } from './dashbord/bookings-table/bookings-table.component';
import { InventoryCardsComponent } from './dashbord/inventory-cards/inventory-cards.component';
import { InquiriesPanelComponent } from './dashbord/inquiries-panel/inquiries-panel.component';
import { DashFooterComponent } from './dashbord/dash-footer/dash-footer.component';
import { AdminUsersPageComponent } from './dashbord/admin-users/admin-users-page.component';

import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';

import { VolsSectionComponent } from './homePage/vols-section.component';
import { VolsListComponent } from './homePage/vols-list.component';
import { MesReservationsComponent } from './homePage/mes-reservations.component';

// ← NOUVEAU
import { BilletComponent } from './billet/billet.component';
import { NouvelleReclamationComponent } from './homePage/reclamations/nouvelle-reclamation.component';
import { MesReclamationsComponent } from './homePage/reclamations/mes-reclamations.component';

import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
import { TransportStatsComponent } from './dashbord/transport-stats/transport-stats.component';
import { ReclamationsSocieteComponent } from './societe/reclamations/reclamations-societe.component';

import {
  BaseChartDirective,
  provideCharts,
  withDefaultRegisterables,
} from 'ng2-charts';
import { AuthInterceptor } from './services/auth.interceptor';

@NgModule({
  declarations: [
    AppComponent,
    FooterComponent,
    HomePageComponent,
    HeroSectionComponent,
    StaysSectionComponent,
    MobilitySectionComponent,
    EventsSectionComponent,
    MarketplaceSectionComponent,
    ChroniclesSectionComponent,

    DashbordPageComponent,
    SideNavComponent,
    DashHeaderComponent,
    StatsOverviewComponent,
    BookingsTableComponent,
    InventoryCardsComponent,
    InquiriesPanelComponent,
    DashFooterComponent,
    AdminUsersPageComponent,

    ResetPasswordComponent,

    VolsSectionComponent,
    VolsListComponent,
    MesReservationsComponent,

    // ← NOUVEAU
    BilletComponent,
    NouvelleReclamationComponent,
    MesReclamationsComponent,
    ReclamationsSocieteComponent,
    WaitingResponsePageComponent,
    TransportStatsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    HomeSharedModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    CommonModule,
    BaseChartDirective,
  ],
  providers: [
    provideCharts(withDefaultRegisterables()),
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true,
    },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
