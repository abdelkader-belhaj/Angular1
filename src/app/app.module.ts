import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { ReactiveFormsModule } from '@angular/forms';
import { FormsModule } from '@angular/forms';
import { HTTP_INTERCEPTORS, HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { NavbarComponent } from './homePage/navbar/navbar.component';
import { FooterComponent } from './homePage/footer/footer.component';
import { HomePageComponent } from './homePage/home-page.component';
import { HeroSectionComponent } from './homePage/hero-section/hero-section.component';
import { StaysSectionComponent } from './homePage/stays-section/stays-section.component';
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
import { LoginDialogComponent } from './homePage/login-dialog/login-dialog.component';
import { ResetPasswordComponent } from './homePage/reset-password/reset-password.component';
import { AuthInterceptor } from './services/auth.interceptor';
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
    CartComponent,
    CheckoutComponent,
    MarketplacePageComponent,
    ArtisansSectionComponent,
    ProductsSectionComponent,
    OrdersSectionComponent,
    PromoSectionComponent,
    DealsSectionComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    ReactiveFormsModule,
    FormsModule,
    HttpClientModule,
    MarketplaceSectionComponent,
    ProductsModule,
    OrdersModule,
    DealsModule
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
