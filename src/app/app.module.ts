// src/app/app.module.ts

import { NgModule, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { CommonModule, registerLocaleData } from '@angular/common';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

// ✅ FIX dates — enregistre la locale française
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);  // ← DOIT être appelé AVANT @NgModule

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AuthInterceptor } from './services/auth.interceptor';

import { NavbarComponent } from './homePage/navbar/navbar.component';
import { FooterComponent } from './homePage/footer/footer.component';
import { HomePageComponent } from './homePage/home-page.component';
import { HeroSectionComponent } from './homePage/hero-section/hero-section.component';
import { StaysSectionComponent } from './homePage/stays-section/stays-section.component';
import { MobilitySectionComponent } from './homePage/mobility-section/mobility-section.component';
import { EventsSectionComponent } from './homePage/events-section/events-section.component';
import { MarketplaceSectionComponent } from './homePage/marketplace-section/marketplace-section.component';
import { ChroniclesSectionComponent } from './homePage/chronicles-section/chronicles-section.component';
import { LoginDialogComponent } from './homePage/login-dialog/login-dialog.component';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';

import { DashbordPageComponent } from './dashbord/dashbord-page.component';
import { SideNavComponent } from './dashbord/side-nav/side-nav.component';
import { DashHeaderComponent } from './dashbord/dash-header/dash-header.component';
import { StatsOverviewComponent } from './dashbord/stats-overview/stats-overview.component';
import { BookingsTableComponent } from './dashbord/bookings-table/bookings-table.component';
import { InventoryCardsComponent } from './dashbord/inventory-cards/inventory-cards.component';
import { InquiriesPanelComponent } from './dashbord/inquiries-panel/inquiries-panel.component';
import { DashFooterComponent } from './dashbord/dash-footer/dash-footer.component';
import { AdminUsersPageComponent } from './dashbord/admin-users/admin-users-page.component';
import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
import { AdminEventsPageComponent } from './dashbord/organisateurs/pages/admin-events-page.component';
import { AdminEventsListComponent } from './dashbord/organisateurs/pages/admin-events-list.component';
import { AdminEventStatCardComponent } from './dashbord/organisateurs/pages/admin-event-stat-card.component';

import { SharedEventModule } from './event/shared-event.module';

@NgModule({
  declarations: [
    AppComponent,
    NavbarComponent,
    FooterComponent,
    HomePageComponent,
    HeroSectionComponent,
    StaysSectionComponent,
    MobilitySectionComponent,
    EventsSectionComponent,
    MarketplaceSectionComponent,
    ChroniclesSectionComponent,
    LoginDialogComponent,
    ResetPasswordComponent,
    DashbordPageComponent,
    SideNavComponent,
    DashHeaderComponent,
    StatsOverviewComponent,
    BookingsTableComponent,
    InventoryCardsComponent,
    InquiriesPanelComponent,
    DashFooterComponent,
    AdminUsersPageComponent,
    AdminEventsPageComponent,
    AdminEventsListComponent,
    AdminEventStatCardComponent,
    WaitingResponsePageComponent,
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    SharedEventModule,
  ],
  providers: [
    // ✅ FIX dates — pipe date affiche maintenant en français
    { provide: LOCALE_ID, useValue: 'fr' },
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}