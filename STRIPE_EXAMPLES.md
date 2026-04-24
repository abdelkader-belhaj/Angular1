# 🔧 Exemples Pratiques - Intégration Stripe

## **Exemple 1: Intégration dans le composant de course active**

```typescript
// active-course.component.ts
import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CourseService } from '../services/course.service';
import { StripePaymentService } from '../services/stripe-payment.service';

@Component({
  selector: 'app-active-course',
  templateUrl: './active-course.component.html',
  styleUrls: ['./active-course.component.css'],
})
export class ActiveCourseComponent implements OnInit {
  courseId: number;
  course: any;
  showPaymentForm = false;
  paymentStep: 'waiting' | 'payment' | 'success' = 'waiting';

  constructor(
    private route: ActivatedRoute,
    private courseService: CourseService,
    private stripeService: StripePaymentService,
    private router: Router,
  ) {}

  ngOnInit(): void {
    this.courseId = +this.route.snapshot.paramMap.get('id');
    this.loadCourse();
  }

  loadCourse(): void {
    this.courseService.getCourseById(this.courseId).subscribe((course) => {
      this.course = course;
    });
  }

  /**
   * Appelé quand le chauffeur complète la course
   */
  completeCourse(): void {
    this.courseService.completeCourse(this.courseId).subscribe({
      next: (completedCourse) => {
        this.course = completedCourse;
        console.log('✅ Course complétée:', completedCourse);

        // Afficher le formulaire de paiement
        this.showPaymentForm = true;
        this.paymentStep = 'payment';
      },
      error: (error) => {
        console.error('❌ Erreur:', error);
        alert('Erreur: ' + error.error?.message);
      },
    });
  }

  /**
   * Callback depuis le composant stripe-payment
   */
  onPaymentSuccess(paiement: any): void {
    this.paymentStep = 'success';

    setTimeout(() => {
      this.router.navigate(['/transport/dashboard']);
    }, 3000);
  }

  onPaymentError(error: string): void {
    console.error('❌ Erreur paiement:', error);
    this.showPaymentForm = false;
  }
}
```

```html
<!-- active-course.component.html -->
<div class="active-course-container">
  <!-- Infos course -->
  <div class="course-info" *ngIf="course">
    <h2>Course en cours</h2>
    <div class="course-details">
      <p>Départ: {{ course.localisationDepart | json }}</p>
      <p>Arrivée: {{ course.localisationArrivee | json }}</p>
      <p>Montant estimé: {{ course.prixFinal | currency: 'TND' }}</p>
    </div>

    <!-- Bouton compléter course -->
    <button
      class="btn btn-primary"
      (click)="completeCourse()"
      *ngIf="paymentStep === 'waiting'"
    >
      ✅ Terminer la course
    </button>
  </div>

  <!-- Formulaire paiement -->
  <div class="payment-section" *ngIf="showPaymentForm">
    <app-stripe-payment
      [courseId]="courseId"
      (paymentSuccess)="onPaymentSuccess($event)"
      (paymentError)="onPaymentError($event)"
    ></app-stripe-payment>
  </div>
</div>
```

---

## **Exemple 2: Intégration dans DemandeCourseService**

```typescript
// demande-course.service.ts - Extension

/**
 * Complète une course et prépare le paiement Stripe
 */
completeCourseWithPayment(courseId: number): Observable<any> {
  return this.api.post(`/courses/${courseId}/complete`, {}).pipe(
    tap(completedCourse => {
      console.log('✅ Course complétée, préparation paiement...');
      // Le frontend affichera maintenant le composant de paiement
    }),
    catchError(error => {
      console.error('❌ Erreur lors de la complétion:', error);
      throw error;
    })
  );
}

/**
 * Ouvre le formulaire de paiement après fin de course
 */
openPaymentFlow(courseId: number): void {
  // Option 1: Dialog/Modal
  // this.dialog.open(StripePaymentComponent, {
  //   data: { courseId }
  // });

  // Option 2: Navigation
  window.location.href = `/transport/payment?courseId=${courseId}`;
}
```

---

## **Exemple 3: Intégration dans le module de transport**

```typescript
// transport.module.ts

import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';

// Composants
import { StripePaymentComponent } from './components/stripe-payment.component';
import { ActiveCourseComponent } from './components/active-course.component';

// Services
import { StripePaymentService } from './services/stripe-payment.service';
import { CourseService } from './services/course.service';

// Routes
import { TransportRoutingModule } from './transport-routing.module';

@NgModule({
  declarations: [
    StripePaymentComponent,
    ActiveCourseComponent,
    // autres composants
  ],
  imports: [
    CommonModule,
    FormsModule, // ← Requis pour ngModel dans formulaire
    ReactiveFormsModule,
    HttpClientModule,
    TransportRoutingModule,
  ],
  providers: [
    StripePaymentService,
    CourseService,
    // autres services
  ],
})
export class TransportModule {}
```

---

## **Exemple 4: Configuration des routes**

```typescript
// transport-routing.module.ts

import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { StripePaymentComponent } from './components/stripe-payment.component';
import { ActiveCourseComponent } from './components/active-course.component';

const routes: Routes = [
  {
    path: 'course/:id',
    component: ActiveCourseComponent,
    // La course complétée affichera automatiquement StripePaymentComponent
  },
  {
    path: 'payment',
    component: StripePaymentComponent,
    // Route alternative: /transport/payment?courseId=1
  },
  {
    path: 'dashboard',
    component: DashboardComponent,
  },
  // autres routes
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TransportRoutingModule {}
```

---

## **Exemple 5: Intercepteur pour ajouter infos au paiement**

```typescript
// payment-confirmation.interceptor.ts

import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpResponse,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class PaymentConfirmationInterceptor implements HttpInterceptor {
  intercept(
    req: HttpRequest<any>,
    next: HttpHandler,
  ): Observable<HttpEvent<any>> {
    // Ajouter des headers au paiement
    if (req.url.includes('/hypercloud/stripe/')) {
      req = req.clone({
        setHeaders: {
          'X-Payment-Version': '1.0',
          'X-Client-Type': 'WEB',
          'X-Timestamp': new Date().toISOString(),
        },
      });
    }

    return next.handle(req).pipe(
      tap(
        (event) => {
          if (event instanceof HttpResponse) {
            if (event.url.includes('/confirm-payment')) {
              console.log('✅ Paiement confirmé au backend');
              // Logger pour analytics
              this.logPaymentEvent(event);
            }
          }
        },
        (error) => {
          if (error.url.includes('/stripe/')) {
            console.error('❌ Erreur paiement Stripe:', error);
            // Envoyer à error tracking (Sentry, etc.)
          }
        },
      ),
    );
  }

  private logPaymentEvent(response: HttpResponse<any>): void {
    // Envoyer à Firebase Analytics, Mixpanel, etc.
    console.log('Event: Payment Confirmed', {
      paiementId: response.body.idPaiement,
      montant: response.body.montantTotal,
      timestamp: new Date(),
    });
  }
}

// Déclarer dans app.module.ts:
// providers: [
//   { provide: HTTP_INTERCEPTORS, useClass: PaymentConfirmationInterceptor, multi: true }
// ]
```

---

## **Exemple 6: Service de gestion d'erreurs Stripe**

```typescript
// stripe-error.handler.ts

import { Injectable } from '@angular/core';
import { ToastrService } from 'ngx-toastr'; // ou votre système de notifications

@Injectable({
  providedIn: 'root',
})
export class StripeErrorHandler {
  private stripeErrorMessages: Record<string, string> = {
    'rate_limit': 'Trop de tentatives. Attendez quelques secondes.',
    'api_connection_error': 'Erreur de connexion. Vérifiez votre internet.',
    'authentication_error': 'Erreur Stripe. Contactez le support.',
    'card_error': 'Carte refusée. Vérifiez vos données.',
    'invalid_request_error': 'Données invalides.',
    'api_error': 'Erreur serveur Stripe. Réessayez.',
    'timeout': 'Delai dépassé. Réessayez.',
  };

  constructor(private toastr: ToastrService) {}

  /**
   * Affiche un message d'erreur Stripe adapté
   */
  handleError(error: any): string {
    const message = this.getErrorMessage(error);

    this.toastr.error(message, 'Erreur paiement', {
      timeOut: 5000,
      progressBar: true,
      closeButton: true,
    });

    // Aussi log pour le debugging
    console.error('Stripe Error:', {
      type: error.type,
      message: error.message,
      code: error.code,
      param: error.param,
      timestamp: new Date(),
    });

    return message;
  }

  private getErrorMessage(error: any): string {
    // Erreurs Stripe directes
    if (error.type) {
      return this.stripeErrorMessages[error.type] || 'Erreur inconnue';
    }

    // Erreurs backend
    if (typeof error === 'string') {
      return error;
    }

    // Erreurs HTTP
    if (error.error?.message) {
      return error.error.message;
    }

    return 'Erreur lors du paiement. Réessayez.';
  }
}

// Utilisation dans stripe-payment.service.ts:
constructor(
  private stripeService: StripePaymentService,
  private errorHandler: StripeErrorHandler
) {}

// Dans confirmPaymentWithCard():
catch (error) {
  const userMessage = this.errorHandler.handleError(error);
  throw error;
}
```

---

## **Exemple 7: Mock service pour tests**

```typescript
// stripe-payment.service.mock.ts

import { Injectable } from '@angular/core';
import { of, throwError } from 'rxjs';
import { PaymentIntentResponse } from '../models/stripe-payment.model';

@Injectable()
export class StripePaymentServiceMock {
  createPaymentIntent(courseId: number) {
    return of<PaymentIntentResponse>({
      clientSecret: 'pi_test_secret_xxx',
      paymentIntentId: 'pi_test_xxx',
      montant: 50,
      montantCommission: 10,
      montantNet: 40,
      paiementId: 1,
      courseId: courseId,
    });
  }

  async setupPaymentForm(containerId: string): Promise<void> {
    console.log('[MOCK] Payment form setup');
  }

  async confirmPaymentWithCard(
    paymentIntentResponse: PaymentIntentResponse,
  ): Promise<any> {
    return {
      success: true,
      paymentIntentId: 'pi_test_xxx',
    };
  }

  confirmPaymentBackend(request: any) {
    return of({
      idPaiement: 1,
      statut: 'COMPLETED',
      montantTotal: 50,
    });
  }

  cleanup(): void {
    console.log('[MOCK] Cleanup');
  }

  isConfigured(): boolean {
    return true;
  }
}
```

---

## **Exemple 8: Tests unitaires**

```typescript
// stripe-payment.component.spec.ts

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StripePaymentComponent } from './stripe-payment.component';
import { StripePaymentService } from '../services/stripe-payment.service';
import { StripePaymentServiceMock } from '../services/stripe-payment.service.mock';
import { ActivatedRoute, Router } from '@angular/router';

describe('StripePaymentComponent', () => {
  let component: StripePaymentComponent;
  let fixture: ComponentFixture<StripePaymentComponent>;
  let stripeService: StripePaymentService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StripePaymentComponent],
      providers: [
        { provide: StripePaymentService, useClass: StripePaymentServiceMock },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: () => '1' } },
          },
        },
        { provide: Router, useValue: { navigate: jasmine.createSpy() } },
      ],
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StripePaymentComponent);
    component = fixture.componentInstance;
    stripeService = TestBed.inject(StripePaymentService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load payment intent on init', (done) => {
    component.ngOnInit();
    fixture.detectChanges();

    fixture.whenStable().then(() => {
      expect(component.paymentDetails).toBeTruthy();
      expect(component.state.step).toBe('form');
      done();
    });
  });

  it('should handle payment confirmation', async () => {
    component.courseId = 1;
    component.paymentDetails = {
      clientSecret: 'pi_test_secret',
      paymentIntentId: 'pi_test_xxx',
      montant: 50,
      montantCommission: 10,
      montantNet: 40,
      paiementId: 1,
      courseId: 1,
    };

    await component.onPayClick();
    fixture.detectChanges();

    fixture.whenStable().then(() => {
      expect(component.state.success).toBe(true);
    });
  });

  it('should show error on payment failure', (done) => {
    component.courseId = 999; // Course inexistante
    component.ngOnInit();
    fixture.detectChanges();

    fixture.whenStable().then(() => {
      expect(component.state.step).toBe('error');
      expect(component.state.error).toBeTruthy();
      done();
    });
  });
});
```

---

## **Exemple 9: Environment-specific config**

```typescript
// environments/environment.ts (DEV)
export const environment = {
  production: false,
  stripe: {
    publicKey: 'pk_test_51234567890...',
    mode: 'test',
  },
  api: {
    baseUrl: 'http://localhost:8080',
  },
};

// environments/environment.prod.ts (PROD)
export const environment = {
  production: true,
  stripe: {
    publicKey: 'pk_live_51234567890...',
    mode: 'live',
  },
  api: {
    baseUrl: 'https://api.production.com',
  },
};

// stripe-payment.config.ts - Utiliser environment
import { environment } from '../../../../environments/environment';

export const STRIPE_CONFIG = {
  publicKey: environment.stripe.publicKey,
  environment: environment.stripe.mode,
};
```

---

## **Exemple 10: Webhook backend (Futur)**

```java
// WebhookController.java (backend - version future)

@RestController
@RequestMapping("/hypercloud/webhooks")
@AllArgsConstructor
@Slf4j
public class WebhookController {

    private final StripePaymentService stripePaymentService;

    @Value("${stripe.webhook.secret}")
    private String webhookSecret;

    /**
     * Endpoint pour les webhooks Stripe
     * À configurer dans Stripe Dashboard → Webhooks
     */
    @PostMapping("/stripe")
    public ResponseEntity<?> handleStripeWebhook(
            @RequestBody String payload,
            @RequestHeader("Stripe-Signature") String signatureHeader
    ) {
        try {
            // Vérifier la signature
            // Event event = Stripe.Webhook.constructEvent(payload, signatureHeader, webhookSecret);

            // Traiter les événements
            // switch (event.getType()) {
            //   case "payment_intent.succeeded":
            //     log.info("✅ Paiement succédé");
            //     break;
            //   case "payment_intent.payment_failed":
            //     log.error("❌ Paiement échoué");
            //     break;
            // }

            return ResponseEntity.ok("Webhook traité");
        } catch (Exception e) {
            log.error("❌ Erreur webhook:", e);
            return ResponseEntity.badRequest().body("Erreur: " + e.getMessage());
        }
    }
}
```

---

## **Résumé des fichiers créés:**

```
Frontend (Angular):
✅ stripe-payment.config.ts       - Configuration clés Stripe
✅ stripe-payment.service.ts      - Service Stripe
✅ stripe-payment.component.ts    - Composant formulaire
✅ stripe-payment.component.html  - Template
✅ stripe-payment.component.css   - Styles
✅ stripe-payment.model.ts        - Modèles TypeScript

Backend (Java - à copier):
✅ StripePaymentService.java      - Service Stripe
✅ StripePaymentController.java   - Endpoints
✅ PaymentIntentResponseDto.java  - DTO réponse
✅ ConfirmPaymentRequestDto.java  - DTO requête
```

À intégrer maintenant dans votre projet!
