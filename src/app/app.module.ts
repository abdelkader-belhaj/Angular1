import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';
import {
  LucideAngularModule,
  Search, SlidersHorizontal, MapPin, Calendar, Users, Star, Heart, ArrowLeft,
  ChevronLeft, ChevronRight, ChevronDown, X, Check, Clock, User, LogOut,
  Settings, Mail, Eye, EyeOff, FileText, Lock, MessageSquare, Phone,
  DoorOpen, Maximize2, PlayCircle, Loader2, CalendarDays, Wallet, CalendarX,
  Bell, Hourglass, XCircle, Edit2, Settings2, AlertCircle, Bot, Fingerprint,
  Unlock, Wifi, Key, ShieldCheck, Send, ShoppingBag, CheckCircle, Layers,
  Trash2, Pencil, CreditCard
} from 'lucide-angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './homePage/navbar/navbar.component';
import { FooterComponent } from './homePage/footer/footer.component';
import { HomePageComponent } from './homePage/home-page.component';
import { HeroSectionComponent } from './homePage/hero-section/hero-section.component';
import { StaysSectionComponent } from './homePage/stays-section_accommodation/stays-section.component';
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
import { LoginDialogComponent } from './homePage/login-dialog/login-dialog.component';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
import { AuthInterceptor } from './services/auth.interceptor';
import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
// Accommodation imports
import { CategorieComponent } from './dashbord/accommodation/categorie/categorie.component';
import { LogementComponent } from './dashbord/accommodation/logement/logement.component';
import { AccommodationsComponent } from './homePage/accommodations/accommodations.component';
import { LogementCardComponent } from './homePage/accommodations/logement-card/logement-card.component';
import { LogementDetailsComponent } from './homePage/accommodations/logement-details/logement-details.component';
import { DateRangePickerComponent } from './homePage/accommodations/logement-details/date-range-picker/date-range-picker.component';
import { MesReservationsComponent } from './homePage/mes-reservations/mes-reservations.component';
import { ReclamationsSpaceComponent } from './reclamations/reclamations-space.component';
import { PaymentPageComponent } from './homePage/payment-page/payment-page.component';
import { PaymentSuccessComponent } from './homePage/payment-success/payment-success.component';
import { PaymentInvoiceComponent } from './homePage/payment-invoice/payment-invoice.component';
// Hebergeur imports
import { HebergeurDashboardComponent } from './hebergeur/hebergeur-dashboard/hebergeur-dashboard.component';
import { HebergeurSideNavComponent } from './hebergeur/hebergeur-side-nav/hebergeur-side-nav.component';
import { HebergeurHomeComponent } from './hebergeur/hebergeur-home/hebergeur-home.component';
import { HebergeurLogementCreateComponent } from './hebergeur/hebergeur-logement-create/hebergeur-logement-create.component';
import { HebergeurSettingsComponent } from './hebergeur/hebergeur-settings/hebergeur-settings.component';
import { HebergeurNotificationsComponent } from './hebergeur/hebergeur-notifications/hebergeur-notifications.component';
import { HebergeurReservationsComponent } from './hebergeur/hebergeur-reservations/hebergeur-reservations.component';
// User standalone imports
import { ProfilePageComponent } from './profile/profile-page.component';
import { SecurityPageComponent } from './security/security-page.component';
import { TransporteurPageComponent } from './transporteur/transporteur-page.component';
import { AirlinePartnerPageComponent } from './airline_partner/airline-partner-page.component';
import { OrganisateurPageComponent } from './organisateur/organisateur-page.component';
import { VendeurArtPageComponent } from './vendeur_art/vendeur-art-page.component';
import { SocietePageComponent } from './societe/societe-page.component';
import { HebergeurPageComponent } from './hebergeur/hebergeur-page.component';

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
    DashbordPageComponent,
    SideNavComponent,
    DashHeaderComponent,
    StatsOverviewComponent,
    BookingsTableComponent,
    InventoryCardsComponent,
    InquiriesPanelComponent,
    DashFooterComponent,
    AdminUsersPageComponent,
    LoginDialogComponent,
    ResetPasswordComponent,
    WaitingResponsePageComponent,
    // Accommodation
    CategorieComponent,
    LogementComponent,
    AccommodationsComponent,
    LogementCardComponent,
    LogementDetailsComponent,
    DateRangePickerComponent,
    MesReservationsComponent,
    ReclamationsSpaceComponent,
    PaymentPageComponent,
    PaymentSuccessComponent,
    PaymentInvoiceComponent,
    // Hebergeur
    HebergeurDashboardComponent,
    HebergeurSideNavComponent,
    HebergeurHomeComponent,
    HebergeurLogementCreateComponent,
    HebergeurSettingsComponent,
    HebergeurNotificationsComponent,
    HebergeurReservationsComponent
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    RouterModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    // User standalone components
    ProfilePageComponent,
    SecurityPageComponent,
    TransporteurPageComponent,
    AirlinePartnerPageComponent,
    OrganisateurPageComponent,
    VendeurArtPageComponent,
    SocietePageComponent,
    HebergeurPageComponent,
    LucideAngularModule.pick({
      Search, SlidersHorizontal, MapPin, Calendar, Users, Star, Heart, ArrowLeft,
      ChevronLeft, ChevronRight, ChevronDown, X, Check, Clock, User, LogOut,
      Settings, Mail, Eye, EyeOff, FileText, Lock, MessageSquare, Phone,
      DoorOpen, Maximize2, PlayCircle, Loader2, CalendarDays, Wallet, CalendarX,
      Bell, Hourglass, XCircle, Edit2, Settings2, AlertCircle, Bot, Fingerprint,
      Unlock, Wifi, Key, ShieldCheck, Send, ShoppingBag, CheckCircle, Layers,
      Trash2, Pencil, CreditCard
    })
  ],
  providers: [
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }