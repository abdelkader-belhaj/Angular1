import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CartService, CartItem } from '../../services/cart.service';
import { OrderService } from '../../services/order.service';
import { PaymentService } from '../../services/payment.service';

@Component({
  selector: 'app-checkout',
  templateUrl: './checkout.component.html',
  styleUrls: ['./checkout.component.css']
})
export class CheckoutComponent implements OnInit {
  checkoutForm!: FormGroup;
  cartTotal: number = 0;
  cartItems: CartItem[] = [];
  isProcessing = false;
  error: string | null = null;
  success: string | null = null;
  paymentMethods = ['Credit Card', 'Debit Card', 'PayPal', 'Bank Transfer'];
  currentStep: 'shipping' | 'payment' | 'review' = 'shipping';
  
  // Payment form
  showPaymentForm = false;
  cardholderName: string = '';
  cardNumber: string = '';
  cardExpiry: string = '';
  cardCvc: string = '';
  paymentError: string | null = null;
  paymentSuccess: string | null = null;
  paymentIntentId: string | null = null;
  
  // Promo code
  promoCode: string = '';
  promoCodeMessage: string = '';
  promoCodeApplied: boolean = false;
  appliedPromoCodeId: number | null = null;
  appliedPromoDiscount: number = 0;
  // Country dropdown
  showCountryDropdown = false;
  filteredCountries: string[] = [];
  countries: string[] = [
    'Afghanistan', 'Afrique du Sud', 'Albanie', 'Algérie', 'Allemagne', 'Andorre', 'Angola', 'Anguilla',
    'Antarctique', 'Antigua-et-Barbuda', 'Arabie Saoudite', 'Argentine', 'Arménie', 'Aruba', 'Australie',
    'Autriche', 'Azerbaïdjan', 'Bahamas', 'Bahreïn', 'Bangladesh', 'Barbade', 'Belgique', 'Belize', 'Bénin',
    'Bermudes', 'Bhoutan', 'Biélorussie', 'Birmanie', 'Birmanie (Myanmar)', 'Bissau',
    'Territoire britannique de l\'océan Indien', 'Brunei', 'Bulgarie', 'Burkina Faso', 'Burundi', 'Cambodge',
    'Cameroun', 'Canada', 'Cap-Vert', 'Chili', 'Chine', 'Chypre', 'Colombie', 'Comores', 'Congo',
    'Corée du Nord', 'Corée du Sud', 'Costa Rica', 'Côte d\'Ivoire', 'Croatie', 'Cuba', 'Curaçao', 'Danemark',
    'Djibouti', 'Dominique', 'Égypte', 'Émirats Arabes Unis', 'Équateur', 'Érythrée', 'Espagne', 'Estonie',
    'États-Unis', 'Éthiopie', 'Fidji', 'Finlande', 'France', 'Gabon', 'Gambie', 'Géorgie', 'Ghana', 'Gibraltar',
    'Grèce', 'Grenade', 'Groenland', 'Guadeloupe', 'Guam', 'Guatemala', 'Guernesey', 'Guinée',
    'Guinée équatoriale', 'Guinée-Bissau', 'Guyana', 'Guyane française', 'Haïti', 'Hongrie', 'Hong Kong',
    'Île Bouvet', 'Île Christmas', 'Île Norfolk', 'Îles Åland', 'Îles Caïmans', 'Îles Cocos', 'Îles Cook',
    'Îles Féroé', 'Îles Heard et McDonald', 'Îles Malouines', 'Îles Mariannes du Nord', 'Îles Marshall',
    'Îles Pitcairn', 'Îles Salomon', 'Îles Turques et Caïques', 'Îles Vierges britanniques',
    'Îles Vierges des États-Unis', 'Inde', 'Indonésie', 'Irak', 'Iran', 'Irlande', 'Islande', 'Israël', 'Italie',
    'Jamaïque', 'Japon', 'Jersey', 'Jordanie', 'Kazakhstan', 'Kenya', 'Kirghizistan', 'Kiribati', 'Koweït', 'Laos',
    'Lesotho', 'Lettonie', 'Liban', 'Liberia', 'Libye', 'Liechtenstein', 'Lituanie', 'Luxembourg', 'Macao',
    'Macédoine', 'Madagascar', 'Malaisie', 'Malawi', 'Maldives', 'Mali', 'Malte', 'Maroc', 'Martinique',
    'Mauritanie', 'Mauritius', 'Mayotte', 'Mexique', 'Micronésie', 'Moldavie', 'Monaco', 'Mongolie', 'Monténégro',
    'Montserrat', 'Mozambique', 'Namibie', 'Nauru', 'Népal', 'Nicaragua', 'Niger', 'Nigéria', 'Niue', 'Norvège',
    'Nouvelle-Calédonie', 'Nouvelle-Zélande', 'Oman', 'Ouganda', 'Ouzbékistan', 'Pakistan', 'Palaos', 'Palestine',
    'Panama', 'Papouasie-Nouvelle-Guinée', 'Paraguay', 'Pays-Bas', 'Pérou', 'Philippines', 'Pologne',
    'Polynésie française', 'Portorico', 'Portugal', 'Qatar', 'République Centrafricaine',
    'République Démocratique du Congo', 'République Dominicaine', 'République Tchèque', 'Réunion', 'Roumanie',
    'Royaume-Uni', 'Russie', 'Rwanda', 'Sahara occidental', 'Saint-Barthélemy', 'Saint-Marin', 'Saint-Martin',
    'Saint-Pierre-et-Miquelon', 'Sainte-Hélène', 'Sainte-Lucie', 'Salvador', 'Samoa', 'Samoa américaine',
    'Serbie', 'Seychelles', 'Sierra Leone', 'Singapour', 'Sint Maarten', 'Slovaquie', 'Slovénie', 'Somalie',
    'Soudan', 'Soudan du Sud', 'Suède', 'Suisse', 'Surinam', 'Swaziland', 'Syrie', 'Tadjikistan', 'Taïwan',
    'Tanzanie', 'Tchad', 'Terres australes françaises', 'Thaïlande', 'Timor oriental', 'Togo', 'Tokelau',
    'Tonga', 'Trinité-et-Tobago', 'Tristan da Cunha', 'Tunisie', 'Turkménistan', 'Turquie', 'Tuvalu', 'Ukraine',
    'Uruguay', 'Vanuatu', 'Vatican', 'Venezuela', 'Vietnam', 'Wallis et Futuna', 'Yémen', 'Zambie', 'Zimbabwe'
  ];

  constructor(
    private fb: FormBuilder,
    private cartService: CartService,
    private orderService: OrderService,
    private paymentService: PaymentService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Initialize country dropdown
    this.filteredCountries = this.countries;

    // Load cart
    this.cartService.getCartItems().subscribe((items) => {
      this.cartItems = items;
      this.cartTotal = this.cartService.getCartTotal();

      if (items.length === 0) {
        this.router.navigate(['/cart']);
      }
    });

    // Initialize form
    this.checkoutForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^(\+)?[\d\s]{8,}$/)]],
      address: ['', [Validators.required, Validators.minLength(5)]],
      city: ['', [Validators.required]],
      postalCode: ['', [Validators.required, Validators.pattern(/^\d{3,6}$/)]],
      country: ['Tunisia', [Validators.required]],
      paymentMethod: ['Credit Card', [Validators.required]],
      termsAgreed: [false, [Validators.requiredTrue]]
    });
  }

  goToStep(step: 'shipping' | 'payment' | 'review'): void {
    if (step === 'payment' && this.isShippingStepValid()) {
      this.currentStep = step;
    } else if (step === 'review' && this.checkoutForm.valid) {
      this.currentStep = step;
    } else if (step === 'shipping') {
      this.currentStep = step;
    }
  }

  isShippingStepValid(): boolean {
    return (
      this.checkoutForm.get('firstName')?.valid === true &&
      this.checkoutForm.get('lastName')?.valid === true &&
      this.checkoutForm.get('email')?.valid === true &&
      this.checkoutForm.get('phone')?.valid === true &&
      this.checkoutForm.get('address')?.valid === true &&
      this.checkoutForm.get('city')?.valid === true &&
      this.checkoutForm.get('postalCode')?.valid === true
    );
  }

  placeOrder(): void {
    if (!this.checkoutForm.valid) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (this.cartItems.length === 0) {
      this.error = 'Your cart is empty';
      return;
    }

    this.isProcessing = true;
    this.error = null;
    this.success = null;

    const formValue = this.checkoutForm.value;
    const shippingAddress = `${formValue.address}, ${formValue.city} ${formValue.postalCode}, ${formValue.country}`;

    const orderRequest: any = {
  shippingAddress: shippingAddress,
  paymentMethod: formValue.paymentMethod,
  clientEmail: formValue.email,        // ✅ already added?
  clientName: `${formValue.firstName} ${formValue.lastName}`, // ✅ already added?
  subtotal: this.cartItems.reduce((sum, item) =>
    sum + ((item.product.discountPrice ?? item.product.price) * item.quantity), 0),
  totalAmount: this.cartTotal,
  discountAmount: this.getTotalDiscount(),
  status: 'pending',
  paymentStatus: 'pending',
  orderDetails: this.cartItems.map(item => ({
    productId: item.product.id,
    productName: item.product.name,
    quantity: item.quantity,
    unitPrice: item.product.discountPrice ?? item.product.price,
    subtotal: (item.product.discountPrice ?? item.product.price) * item.quantity
  }))
};

if (this.appliedPromoCodeId) {
  orderRequest.promoCodeId = this.appliedPromoCodeId;
}

// ✅ Send promoCodeId (number), not promoCode (string)
if (this.appliedPromoCodeId) {
  orderRequest.promoCodeId = this.appliedPromoCodeId;
}

    console.log('Creating order with:', orderRequest);
    this.orderService.createOrder(orderRequest).subscribe({
        next: (response: any) => {
        this.cartService.clearCart();
        this.isProcessing = false;
        this.showPaymentForm = false;

        setTimeout(() => {
          this.router.navigate(['/my-orders']);
        }, 2000);
      },
      error: (err) => {
        console.error('Order creation error:', err);
        console.error('Error details:', err.error);
        this.error = err.error?.message || 'Erreur lors de la création de la commande. Veuillez réessayer.';
        this.isProcessing = false;
      }
    });
  }

  getShippingAddress(): string {
    const form = this.checkoutForm.value;
    return `${form.address}, ${form.city} ${form.postalCode}, ${form.country}`;
  }

  backToCart(): void {
    this.router.navigate(['/cart']);
  }

  getCartSubtotal(): number {
    return this.cartService.getCartSubtotal();
  }

  getTotalDiscount(): number {
  return this.appliedPromoDiscount;
}

  getImageUrl(image: string): string {
    if (!image) {
      return '';
    }
    if (image.startsWith('http')) {
      return image;
    }
    return `http://localhost:8080/${image}`;
  }

  filterCountries(event: any): void {
    const searchValue = event.target.value.toLowerCase();
    this.showCountryDropdown = true;
    
    if (!searchValue) {
      this.filteredCountries = this.countries;
    } else {
      this.filteredCountries = this.countries.filter(country =>
        country.toLowerCase().includes(searchValue)
      );
    }
  }

  selectCountry(country: string): void {
    this.checkoutForm.patchValue({ country });
    this.showCountryDropdown = false;
  }

  applyPromoCode(): void {
  if (!this.promoCode.trim()) {
    this.promoCodeMessage = 'Veuillez entrer un code promo';
    this.promoCodeApplied = false;
    return;
  }

  this.orderService.validatePromoCode(this.promoCode.trim()).subscribe({
    next: (response: any) => {
      const promo = response.data || response;

      if (!promo.isActive) {
        this.promoCodeMessage = 'Ce code promo est inactif';
        this.promoCodeApplied = false;
        this.appliedPromoCodeId = null;
        return;
      }

      this.appliedPromoCodeId = promo.id;

      // ✅ Calculate from actual cart items, not getCartSubtotal()
      const realSubtotal = this.cartItems.reduce((sum, item) =>
        sum + ((item.product.discountPrice ?? item.product.price) * item.quantity), 0);

      this.appliedPromoDiscount = realSubtotal * promo.discountPercentage / 100;
      this.cartTotal = realSubtotal - this.appliedPromoDiscount;

      this.promoCodeApplied = true;
      this.promoCodeMessage = `✓ Code "${promo.code}" appliqué — ${promo.discountPercentage}% de réduction`;
    },
    error: () => {
      this.promoCodeMessage = 'Code promo invalide ou introuvable';
      this.promoCodeApplied = false;
      this.appliedPromoCodeId = null;
    }
  });
}

  // Payment Methods
  initializePayment(): void {
    console.log('initializePayment called');
    console.log('Form valid:', this.checkoutForm.valid);
    console.log('Form errors:', this.checkoutForm.errors);
    
    if (!this.checkoutForm.valid) {
      // Show which fields are invalid
      Object.keys(this.checkoutForm.controls).forEach(key => {
        const control = this.checkoutForm.get(key);
        if (control && control.invalid) {
          console.log(`Invalid field: ${key}`, control.errors);
        }
      });
      this.error = 'Veuillez remplir tous les champs requis';
      return;
    }

    // Show payment form
    this.showPaymentForm = true;
    this.isProcessing = false;
    this.paymentError = null;
    this.paymentSuccess = null;
    console.log('Payment form opened. Total: ' + this.cartTotal + ' TND');
  }

  formatCardNumber(event: any): void {
    let value = event.target.value.replace(/\s/g, '');
    let formattedValue = '';

    for (let i = 0; i < value.length; i++) {
      if (i > 0 && i % 4 === 0) {
        formattedValue += ' ';
      }
      formattedValue += value[i];
    }

    this.cardNumber = formattedValue;
  }

  formatExpiry(event: any): void {
    let value = event.target.value.replace(/\D/g, '');

    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2, 4);
    }

    this.cardExpiry = value;
  }

  processPayment(): void {
    // Validate card details
    if (!this.cardholderName.trim()) {
      this.paymentError = 'Veuillez entrer le nom du titulaire';
      return;
    }

    if (!this.cardNumber || this.cardNumber.replace(/\s/g, '').length !== 16) {
      this.paymentError = 'Veuillez entrer un numéro de carte valide';
      return;
    }

    if (!this.cardExpiry || this.cardExpiry.length !== 5) {
      this.paymentError = 'Veuillez entrer une date d\'expiration valide (MM/YY)';
      return;
    }

    if (!this.cardCvc || this.cardCvc.length < 3) {
      this.paymentError = 'Veuillez entrer un CVC valide';
      return;
    }

    this.isProcessing = true;
    this.paymentError = null;

    // In a real implementation, you would use Stripe's tokenization
    // For now, we'll simulate a successful payment
    setTimeout(() => {
      if (this.cardNumber === '4242424242424242' || this.cardNumber === '4242 4242 4242 4242') {
        // Test card - simulate success
        this.paymentSuccess = 'Paiement réussi! Votre commande est en cours de traitement...';
        this.isProcessing = false;
      } else {
        // Any other card number - simulate failure
        this.paymentError = 'Le paiement a échoué. Veuillez vérifier vos informations et réessayer.';
        this.isProcessing = false;
      }
    }, 2000);
  }

  cancelPayment(): void {
    this.showPaymentForm = false;
    this.paymentError = null;
    this.paymentSuccess = null;
    this.cardholderName = '';
    this.cardNumber = '';
    this.cardExpiry = '';
    this.cardCvc = '';
    this.isProcessing = false;
  }

  completeOrder(): void {
    this.isProcessing = true;
    this.placeOrder();
  }
}
