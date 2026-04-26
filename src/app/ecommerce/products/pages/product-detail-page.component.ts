import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductService, Product } from '../../../services/product.service';
import { CartService } from '../../../services/cart.service';

@Component({
  selector: 'app-product-detail-page',
  templateUrl: './product-detail-page.component.html',
  styleUrls: ['./product-detail-page.component.css']
})
export class ProductDetailPageComponent implements OnInit {
  product: Product | null = null;
  relatedProducts: Product[] = [];
  
  isLoading = false;
  error: string | null = null;
  
  quantity = 1;
  isAddingToCart = false;
  addedToCart = false;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private route: ActivatedRoute,
    public router: Router
  ) {}

  ngOnInit(): void {
    this.loadProduct();
  }

  loadProduct(): void {
  this.isLoading = true;
  this.error = null;

  const id = this.route.snapshot.paramMap.get('id');
  if (!id) {
    this.error = 'ID du produit non trouvé';
    this.isLoading = false;
    return;
  }

  this.productService.getProductById(parseInt(id)).subscribe({
    next: (product) => {
      this.product = product;
        console.log('Product loaded, categoryId:', this.product.categoryId);  // ✅
      if (this.product.categoryId) {
        this.productService.getCategoryById(this.product.categoryId).subscribe({
          next: (category) => {
            console.log('Category fetched:', category);
            if (this.product) {
              this.product.category = category.name;
            }
          },
          error: (err) => {
            console.error('Category fetch error:', err);
          }
        });
      }
      this.loadRelatedProducts();
      this.isLoading = false;
    },
    error: () => {
      this.error = 'Erreur lors du chargement du produit';
      this.isLoading = false;
    }
  });
}

  loadRelatedProducts(): void {
    if (!this.product) return;
    const categoryId = this.product.categoryId;
    this.productService.getProductsByCategory(categoryId).subscribe({
      next: (products) => {
        this.relatedProducts = products.filter(p => p.id !== this.product?.id).slice(0, 4);
      }
    });
  }

  addToCart(): void {
    if (!this.product) return;
    
    this.isAddingToCart = true;
    // CartService.addToCart doesn't return Observable, it's void
    this.cartService.addToCart(this.product, this.quantity);
    
    this.isAddingToCart = false;
    this.addedToCart = true;
    setTimeout(() => {
      this.addedToCart = false;
    }, 2000);
  }

  increaseQuantity(): void {
    if (this.product && this.quantity < 99) {
      this.quantity++;
    }
  }

  decreaseQuantity(): void {
    if (this.quantity > 1) {
      this.quantity--;
    }
  }

  goToCart(): void {
    this.router.navigate(['/cart']);
  }

  viewProduct(id: number): void {
    this.router.navigate(['/product', id]);
    window.scrollTo(0, 0);
  }
}
