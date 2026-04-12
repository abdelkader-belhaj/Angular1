import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ArtisanService, ArtisanProduct } from '../../../services/artisan.service';
import { ProductService, ProductCategory } from '../../../services/product.service';
import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-manage-products',
  templateUrl: './manage-products.component.html',
  styleUrls: ['./manage-products.component.css']
})
export class ManageProductsComponent implements OnInit {
  @ViewChild('formSection') formSection!: ElementRef;

  products: ArtisanProduct[] = [];
  isLoading = true;
  showForm = false;
  isEditing = false;
  editingProductId: number | null = null;
  sidebarOpen = true;

  productForm!: FormGroup;
  selectedProductImage: File | null = null;
  imagePreviewUrl: string | null = null;
  isUploadingImage = false;

  // Category management
  allCategories: ProductCategory[] = [];
  subcategories: ProductCategory[] = [];
  selectedCategoryId: number | null = null;
  isLoadingCategories = false;

  constructor(
    private artisanService: ArtisanService,
    private productService: ProductService,
    private fb: FormBuilder,
    private router: Router,
    private activatedRoute: ActivatedRoute,
    private authService: AuthService
  ) {
    this.initializeForm();
  }

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
    this.checkIfAddMode();
  }

  initializeForm(): void {
    this.productForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      description: ['', [Validators.required, Validators.minLength(10)]],
      price: ['', [Validators.required, Validators.min(0)]],
      stockQuantity: ['', [Validators.required, Validators.min(0)]],
      categoryId: ['', Validators.required],
      subcategoryId: [null],
      discountPrice: [null, this.validateDiscountPrice.bind(this)]
    });

    // Listen to category changes to update subcategories
    this.productForm.get('categoryId')?.valueChanges.subscribe((categoryId) => {
      this.onCategoryChange(categoryId);
    });
  }

  // Custom validator for discount price
  validateDiscountPrice(control: any): any {
    if (!control.value) {
      return null; // Optional field
    }
    
    const discountPrice = parseFloat(control.value);
    const regularPrice = parseFloat(this.productForm?.get('price')?.value || 0);
    
    if (discountPrice > 0 && discountPrice >= regularPrice) {
      return { invalidDiscount: true };
    }
    
    return null;
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    console.log('Starting to load categories...');
    this.productService.getAllCategories().subscribe(
      (categories) => {
        console.log('Categories loaded successfully:', categories);
        this.allCategories = categories;
        this.isLoadingCategories = false;
        console.log('Categories assigned to allCategories:', this.allCategories);
      },
      (error) => {
        console.error('Error loading categories:', error);
        console.error('Error status:', error.status);
        console.error('Error statusText:', error.statusText);
        console.error('Error message:', error.message);
        this.isLoadingCategories = false;
      }
    );
  }

  onCategoryChange(categoryId: string | number): void {
    this.selectedCategoryId = categoryId ? Number(categoryId) : null;
    this.subcategories = [];
    this.productForm.get('subcategoryId')?.setValue(null);

    if (this.selectedCategoryId) {
      // Find the selected category and get its subcategories
      const selectedCat = this.allCategories.find(cat => cat.id === this.selectedCategoryId);
      if (selectedCat && selectedCat.children && selectedCat.children.length > 0) {
        this.subcategories = selectedCat.children;
      }
    }
  }

  loadProducts(): void {
    this.artisanService.getArtisanProducts().subscribe(
      (products) => {
        this.products = products;
        this.isLoading = false;
      },
      (error) => {
        console.error('Error loading products:', error);
        this.isLoading = false;
      }
    );
  }

  checkIfAddMode(): void {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['add']) {
        this.showForm = true;
      }
    });
  }

  toggleForm(): void {
    this.showForm = !this.showForm;
    this.isEditing = false;
    this.editingProductId = null;
    this.productForm.reset();
    this.selectedProductImage = null;
    this.imagePreviewUrl = null;
    this.subcategories = [];
    this.selectedCategoryId = null;
  }

  onImageSelected(event: any): void {
    const file: File = event.target.files[0];
    if (file) {
      // Validate file type
      const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !validExtensions.includes(fileExtension)) {
        alert('Invalid file format. Allowed: JPG, PNG, GIF, WEBP');
        return;
      }

      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (file.size > maxSize) {
        alert('File size must be less than 5MB');
        return;
      }

      this.selectedProductImage = file;
      // Create preview URL
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.imagePreviewUrl = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  clearImageSelection(): void {
    this.selectedProductImage = null;
    this.imagePreviewUrl = null;
    const fileInput = document.getElementById('product-image') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  }

  editProduct(product: ArtisanProduct): void {
    this.isEditing = true;
    this.editingProductId = product.id;
    this.showForm = true;
    this.productForm.patchValue({
      name: product.name,
      description: product.description,
      price: product.price,
      stockQuantity: product.stockQuantity,
      categoryId: product.categoryId,
      subcategoryId: product.subcategoryId || null,
      discountPrice: product.discountPrice || null
    });
    // Trigger subcategory loading
    this.onCategoryChange(product.categoryId);
    // Show existing image as preview
    if (product.image) {
      this.imagePreviewUrl = product.image;
    }
    
    // Scroll to form with smooth behavior
    setTimeout(() => {
      this.formSection.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  saveProduct(): void {
    if (!this.productForm.valid) {
      alert('Veuillez remplir tous les champs correctement');
      return;
    }

    // Validate discount price
    const discountPrice = this.productForm.get('discountPrice')?.value;
    const regularPrice = this.productForm.get('price')?.value;
    
    if (discountPrice && discountPrice >= regularPrice) {
      alert('Le prix réduit doit être inférieur au prix normal');
      return;
    }

    const productData = {
      name: this.productForm.get('name')?.value,
      description: this.productForm.get('description')?.value,
      price: this.productForm.get('price')?.value,
      stockQuantity: this.productForm.get('stockQuantity')?.value,
      categoryId: Number(this.productForm.get('categoryId')?.value),
      subcategoryId: this.productForm.get('subcategoryId')?.value ? Number(this.productForm.get('subcategoryId')?.value) : undefined,
      discountPrice: discountPrice || null,
      image: undefined as string | undefined
    };

    if (this.isEditing && this.editingProductId) {
      // Update existing product
      // If no new image was selected, include the existing image to prevent it from being erased
      if (!this.selectedProductImage && this.imagePreviewUrl) {
        productData.image = this.imagePreviewUrl;
      }

      this.artisanService.updateProduct(this.editingProductId, productData).subscribe(
        () => {
          // Upload image if selected
          if (this.selectedProductImage) {
            this.uploadProductImage(this.editingProductId!);
          } else {
            alert('Produit mis à jour avec succès!');
            this.loadProducts();
            this.toggleForm();
          }
        },
        (error) => {
          console.error('Error updating product:', error);
          alert('Erreur lors de la mise à jour du produit');
        }
      );
    } else {
      // Create new product
      this.artisanService.createProduct(productData).subscribe(
        (newProduct: any) => {
          // Upload image if selected
          if (this.selectedProductImage) {
            this.uploadProductImage(newProduct.id);
          } else {
            alert('Produit créé avec succès!');
            this.loadProducts();
            this.toggleForm();
          }
        },
        (error) => {
          console.error('Error creating product:', error);
          alert('Erreur lors de la création du produit');
        }
      );
    }
  }

  uploadProductImage(productId: number): void {
    if (!this.selectedProductImage) {
      return;
    }

    this.isUploadingImage = true;
    this.productService.uploadProductImage(productId, this.selectedProductImage, true).subscribe(
      (response) => {
        this.isUploadingImage = false;
        if (response.success) {
          alert('Produit et image sauvegardés avec succès!');
          this.loadProducts();
          this.toggleForm();
        } else {
          alert('Erreur lors de l\'upload de l\'image: ' + response.message);
        }
      },
      (error) => {
        this.isUploadingImage = false;
        console.error('Error uploading image:', error);
        alert('Erreur lors de l\'upload de l\'image');
      }
    );
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  deleteProduct(productId: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce produit?')) {
      this.artisanService.deleteProduct(productId).subscribe(
        () => {
          alert('Produit supprimé avec succès!');
          this.loadProducts();
        },
        (error) => {
          console.error('Error deleting product:', error);
          alert('Erreur lors de la suppression du produit');
        }
      );
    }
  }

  deleteProductImage(productId: number): void {
    if (confirm('Êtes-vous sûr de vouloir supprimer l\'image?')) {
      this.productService.deleteProductImage(productId).subscribe(
        (response) => {
          if (response.success) {
            alert('Image supprimée avec succès!');
            this.loadProducts();
          }
        },
        (error) => {
          console.error('Error deleting image:', error);
          alert('Erreur lors de la suppression de l\'image');
        }
      );
    }
  }

  getStatusColor(status: string): string {
    switch(status) {
      case 'active': return 'bg-green-100 text-green-700';
      case 'inactive': return 'bg-gray-100 text-gray-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  }

  // Build the correct image URL for backend resources
  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) {
      return 'assets/placeholder-image.png'; // Fallback to placeholder if no image
    }
    // If it's already a full URL, return it as is
    if (imagePath.startsWith('http')) {
      return imagePath;
    }
    // Otherwise, prepend the backend URL
    return 'http://localhost:8080/' + imagePath;
  }

  // Helper methods for discount calculation
  calculateDiscountPercentage(price: number, discountPrice: number | undefined): number {
    if (!discountPrice || discountPrice <= 0) {
      return 0;
    }
    return Math.round(((price - discountPrice) / price) * 100);
  }

  hasDiscount(product: ArtisanProduct): boolean {
    return product.discountPrice !== null && product.discountPrice !== undefined && product.discountPrice > 0;
  }

  getDiscountPercentageClass(discount: number): string {
    if (discount >= 30) return 'bg-red-600';
    if (discount >= 15) return 'bg-orange-500';
    return 'bg-green-600';
  }

  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
  }
}
