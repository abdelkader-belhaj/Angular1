import { NgModule, CUSTOM_ELEMENTS_SCHEMA, LOCALE_ID } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { CommonModule, registerLocaleData } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

// ✅ FIX dates — enregistre la locale française
import localeFr from '@angular/common/locales/fr';
registerLocaleData(localeFr);

import {
  LucideAngularModule,
  Search, SlidersHorizontal, MapPin, Calendar, Users, Star, Heart,
  ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, X, Check, Clock,
  User, LogOut, Settings, Mail, Eye, EyeOff, FileText, Lock, MessageSquare,
  Phone, DoorOpen, Maximize2, PlayCircle, Loader2, CalendarDays, Wallet,
  CalendarX, Bell, Hourglass, XCircle, Edit2, Settings2, AlertCircle,
  Bot, Fingerprint, Unlock, Wifi, Key, ShieldCheck, Send, ShoppingBag,
  CheckCircle, Layers, Trash2, Pencil, CreditCard, Plane,
} from 'lucide-angular';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeSharedModule } from './homePage/home-shared.module';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { FooterComponent } from './homePage/footer/footer.component';
import { HomePageComponent } from './homePage/home-page.component';
import { HeroSectionComponent } from './homePage/hero-section/hero-section.component';
import { StaysSectionComponent } from './homePage/stays-section_accommodation/stays-section.component';
import { MobilitySectionComponent } from './homePage/mobility-section/mobility-section.component';
import { EventsSectionComponent } from './homePage/events-section/events-section.component';
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
import { TransportStatsComponent } from './dashbord/transport-stats/transport-stats.component';
import { CommunityAdminComponent } from './dashbord/community-admin/community-admin.component';
import { AdminEventsPageComponent } from './dashbord/organisateurs/pages/admin-events-page.component';
import { AdminEventsListComponent } from './dashbord/organisateurs/pages/admin-events-list.component';
import { AdminEventStatCardComponent } from './dashbord/organisateurs/pages/admin-event-stat-card.component';

import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
import { VolsSectionComponent } from './homePage/vols-section.component';
import { VolsListComponent } from './homePage/vols-list.component';
import { MesReservationsComponent } from './homePage/mes-reservations.component';

import { BilletComponent } from './billet/billet.component';
import { NouvelleReclamationComponent } from './homePage/reclamations/nouvelle-reclamation.component';
import { MesReclamationsComponent } from './homePage/reclamations/mes-reclamations.component';

import { CommunityListComponent } from './homePage/community/community-list/community-list.component';
import { CommunityDetailComponent } from './homePage/community/community-detail/community-detail.component';
import { ForumDetailComponent } from './homePage/forum/forum-detail/forum-detail.component';
import { ForumCardComponent } from './homePage/forum/forum-card/forum-card.component';
import { CommentSectionComponent } from './homePage/forum/comment-section/comment-section.component';
import { ReviewSectionComponent } from './homePage/forum/review-section/review-section.component';
import { ForumConditionsModalComponent } from './homePage/forum/forum-conditions-modal/forum-conditions-modal.component';

import { WaitingResponsePageComponent } from './waiting-response/waiting-response-page.component';
import { MarketplaceSectionComponent } from './homePage/marketplace-section/marketplace-section.component';
import { ProductsModule } from './ecommerce/products/products.module';
import { CartComponent } from './ecommerce/cart/cart.component';
import { CheckoutComponent } from './ecommerce/checkout/checkout.component';
import { OrdersModule } from './ecommerce/orders/orders.module';
import { DealsModule } from './ecommerce/deals/deals.module';
import { MarketplacePageComponent } from './dashbord/marketplace/marketplace-page.component';
import { ArtisansSectionComponent } from './dashbord/marketplace/sections/artisans-section.component';
import { ProductsSectionComponent } from './dashbord/marketplace/sections/products-section.component';
import { OrdersSectionComponent } from './dashbord/marketplace/sections/orders-section.component';
import { PromoSectionComponent } from './dashbord/marketplace/sections/promo-section.component';
import { DealsSectionComponent } from './dashbord/marketplace/sections/deals-section.component';


import { CategorieComponent } from './dashbord/accommodation/categorie/categorie.component';
import { LogementComponent } from './dashbord/accommodation/logement/logement.component';
import { AccommodationsComponent } from './homePage/accommodations/accommodations.component';
import { LogementCardComponent } from './homePage/accommodations/logement-card/logement-card.component';
import { LogementDetailsComponent } from './homePage/accommodations/logement-details/logement-details.component';
import { DateRangePickerComponent } from './homePage/accommodations/logement-details/date-range-picker/date-range-picker.component';
import { MesReservationsComponent as MesReservationsV2Component } from './homePage/mes-reservations/mes-reservations.component';
import { ReclamationsSpaceComponent } from './reclamations/reclamations-space.component';
import { PaymentPageComponent } from './homePage/payment-page/payment-page.component';
import { PaymentSuccessComponent } from './homePage/payment-success/payment-success.component';
import { PaymentInvoiceComponent } from './homePage/payment-invoice/payment-invoice.component';
import { PreferencesFormComponent } from './homePage/accommodations/preferences-form/preferences-form.component';

import { HebergeurDashboardComponent } from './hebergeur/hebergeur-dashboard/hebergeur-dashboard.component';
import { HebergeurSideNavComponent } from './hebergeur/hebergeur-side-nav/hebergeur-side-nav.component';
import { HebergeurHomeComponent } from './hebergeur/hebergeur-home/hebergeur-home.component';
import { HebergeurLogementCreateComponent } from './hebergeur/hebergeur-logement-create/hebergeur-logement-create.component';
import { HebergeurSettingsComponent } from './hebergeur/hebergeur-settings/hebergeur-settings.component';
import { HebergeurNotificationsComponent } from './hebergeur/hebergeur-notifications/hebergeur-notifications.component';
import { HebergeurReservationsComponent } from './hebergeur/hebergeur-reservations/hebergeur-reservations.component';

import { ProfilePageComponent } from './profile/profile-page.component';
import { SecurityPageComponent } from './security/security-page.component';
import { TransporteurPageComponent } from './transporteur/transporteur-page.component';
import { AirlinePartnerPageComponent } from './airline_partner/airline-partner-page.component';
import { OrganisateurPageComponent } from './organisateur/organisateur-page.component';
import { SocietePageComponent } from './societe/societe-page.component';
import { HebergeurPageComponent } from './hebergeur/hebergeur-page.component';
import { ReclamationsSocieteComponent } from './societe/reclamations/reclamations-societe.component';

import { SharedEventModule } from './event/shared-event.module';
import { BaseChartDirective, provideCharts, withDefaultRegisterables } from 'ng2-charts';

@NgModule({
  declarations: [
    AppComponent,
    FooterComponent,
    HomePageComponent,
    HeroSectionComponent,
    StaysSectionComponent,
    MobilitySectionComponent,
    EventsSectionComponent,
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
    AdminEventsPageComponent,
    AdminEventsListComponent,
    AdminEventStatCardComponent,
    TransportStatsComponent,
    CommunityAdminComponent,
    ResetPasswordComponent,
    WaitingResponsePageComponent,
    CartComponent,
    CheckoutComponent,
    MarketplacePageComponent,
    ArtisansSectionComponent,
    ProductsSectionComponent,
    OrdersSectionComponent,
    PromoSectionComponent,
    DealsSectionComponent,
    CategorieComponent,
    LogementComponent,
    AccommodationsComponent,
    LogementCardComponent,
    LogementDetailsComponent,
    DateRangePickerComponent,
    MesReservationsV2Component,
    ReclamationsSpaceComponent,
    PaymentPageComponent,
    PaymentSuccessComponent,
    PaymentInvoiceComponent,
    PreferencesFormComponent,
    HebergeurDashboardComponent,
    HebergeurSideNavComponent,
    HebergeurHomeComponent,
    HebergeurLogementCreateComponent,
    HebergeurSettingsComponent,
    HebergeurNotificationsComponent,
    HebergeurReservationsComponent,
    CommunityListComponent,
    CommunityDetailComponent,
    ForumDetailComponent,
    ForumCardComponent,
    CommentSectionComponent,
    ReviewSectionComponent,
    ForumConditionsModalComponent,
    VolsSectionComponent,
    VolsListComponent,
    MesReservationsComponent,
    BilletComponent,
    NouvelleReclamationComponent,
    MesReclamationsComponent,
    ReclamationsSocieteComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    CommonModule,
    RouterModule,
    AppRoutingModule,
    HomeSharedModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    MarketplaceSectionComponent,
    ProductsModule,
    OrdersModule,
    DealsModule,
    SharedEventModule,
    ProfilePageComponent,
    SecurityPageComponent,
    TransporteurPageComponent,
    AirlinePartnerPageComponent,
    OrganisateurPageComponent,
    SocietePageComponent,
    HebergeurPageComponent,
    BaseChartDirective,
    LucideAngularModule.pick({
      Search, SlidersHorizontal, MapPin, Calendar, Users, Star, Heart,
      ArrowLeft, ChevronLeft, ChevronRight, ChevronDown, X, Check, Clock,
      User, LogOut, Settings, Mail, Eye, EyeOff, FileText, Lock, MessageSquare,
      Phone, DoorOpen, Maximize2, PlayCircle, Loader2, CalendarDays, Wallet,
      CalendarX, Bell, Hourglass, XCircle, Edit2, Settings2, AlertCircle,
      Bot, Fingerprint, Unlock, Wifi, Key, ShieldCheck, Send, ShoppingBag,
      CheckCircle, Layers, Trash2, Pencil, CreditCard, Plane,
    }),
  ],
  providers: [
    { provide: LOCALE_ID, useValue: 'fr' },
    provideCharts(withDefaultRegisterables()),
    { provide: HTTP_INTERCEPTORS, useClass: AuthInterceptor, multi: true },
  ],
  bootstrap: [AppComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class AppModule { }