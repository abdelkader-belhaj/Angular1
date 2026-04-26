import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';

interface Deal {
  id: number;
  title: string;
  description: string;
  location: string;
  region: string;
  budget: string;
  image?: string;
  activityType: string;
  environment: string;
  category: string;
  duration: string;
  favoritesCount: number;
}

interface AiGenerateResponse {
  title: string;
  description: string;
  location: string;
  region: string;
  budget: string;
  activityType: string;
  environment: string;
  category: string;
  duration: string;
  imageUrl: string | null;
}

@Component({
  selector: 'app-deals-section',
  templateUrl: './deals-section.component.html',
  styleUrl: './deals-section.component.css'
})
export class DealsSectionComponent implements OnInit {
  deals: Deal[] = [];
  isLoading = true;
  error: string | null = null;
  selectedDeal: Deal | null = null;
  showEditModal = false;
  showCreateForm = false;
  dealForm!: FormGroup;
  isSubmitting = false;
  selectedFile: File | null = null;
  imagePreviewUrl: string | null = null;

  // --- AI additions ---
  aiDescription = '';
  isGenerating = false;
  aiError: string | null = null;
  aiImageUrl: string | null = null;  // the saved path returned by backend
  // --------------------

  regions     = ['north', 'south', 'center', 'east_coast', 'sahara'];
  budgets     = ['low', 'medium', 'high'];
  activityTypes = ['solo', 'duo', 'group', 'flexible'];
  environments  = ['indoor', 'outdoor', 'both'];
  categories  = ['adventure', 'culture_history', 'food', 'relaxation',
                  'water_sports', 'crafts', 'nature_hiking', 'heritage', 'photography'];
  durations   = ['one_hour', 'two_hours', 'three_hours', 'half_day',
                  'full_day', 'two_days', 'three_days_plus', 'weekend'];

  constructor(private http: HttpClient, private fb: FormBuilder) {
    this.initializeForm();
  }

  ngOnInit() {
    this.loadDeals();
  }

  initializeForm() {
    this.dealForm = this.fb.group({
      title:        ['', [Validators.required, Validators.minLength(3)]],
      description:  ['', [Validators.required, Validators.minLength(10)]],
      location:     ['', Validators.required],
      region:       ['', Validators.required],
      budget:       ['', Validators.required],
      activityType: ['', Validators.required],
      environment:  ['', Validators.required],
      category:     ['', Validators.required],
      duration:     ['', Validators.required],
      image:        ['']
    });
  }

  // ─── AI GENERATION ───────────────────────────────────────────────────────────

  generateWithAI(): void {
    if (!this.aiDescription.trim()) return;

    this.isGenerating = true;
    this.aiError = null;
    this.aiImageUrl = null;

    this.http.post<AiGenerateResponse>(
      'http://localhost:8080/api/deals/ai-generate',
      { description: this.aiDescription }
    ).subscribe({
      next: (result) => {
        // Fill every form field
        this.dealForm.patchValue({
          title:        result.title,
          description:  result.description,
          location:     result.location,
          region:       result.region,
          budget:       result.budget,
          activityType: result.activityType,
          environment:  result.environment,
          category:     result.category,
          duration:     result.duration
        });

        // Handle the AI-generated image
        if (result.imageUrl) {
          this.aiImageUrl = result.imageUrl;
          // Show it in the existing preview area
          this.imagePreviewUrl = this.getImageUrl(result.imageUrl);
          // Store the path so createDeal() can send it
          this.dealForm.patchValue({ image: result.imageUrl });
        }

        this.isGenerating = false;
      },
      error: (err) => {
        console.error('AI generation error:', err);
        this.aiError = 'La génération IA a échoué. Veuillez réessayer.';
        this.isGenerating = false;
      }
    });
  }

  clearAiDescription(): void {
    this.aiDescription = '';
    this.aiError = null;
  }

  // ─────────────────────────────────────────────────────────────────────────────

  loadDeals() {
    this.isLoading = true;
    this.error = null;
    this.http.get<any>('http://localhost:8080/api/ecommerce/deals').subscribe(
      (data) => {
        this.deals = Array.isArray(data) ? data : data.data || [];
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Failed to load deals';
        console.error(error);
        this.isLoading = false;
      }
    );
  }

  createDeal() {
    if (this.dealForm.invalid) {
      this.error = 'Please fill all required fields';
      return;
    }

    this.isSubmitting = true;
    const dealData = { ...this.dealForm.value };
    delete dealData.image;

    this.http.post<any>('http://localhost:8080/api/ecommerce/deals', dealData).subscribe(
      (response) => {
        const newDeal = response.data || response;

        if (this.selectedFile) {
          // Admin manually picked a file → upload it
          this.uploadDealImage(newDeal.id);
        } else if (this.aiImageUrl) {
          // AI generated image already saved on disk → just update the deal record
          this.http.put<any>(
            `http://localhost:8080/api/ecommerce/deals/${newDeal.id}`,
            { ...newDeal, image: this.aiImageUrl }
          ).subscribe(() => {
            this.loadDeals();
            this.resetCreateForm();
          });
        } else {
          this.deals.push(newDeal);
          this.resetCreateForm();
        }
      },
      (error) => {
        this.error = 'Error creating deal';
        console.error('Full error:', error.error);
        this.isSubmitting = false;
      }
    );
  }

  private resetCreateForm(): void {
    this.dealForm.reset();
    this.selectedFile = null;
    this.imagePreviewUrl = null;
    this.aiImageUrl = null;
    this.aiDescription = '';
    this.aiError = null;
    this.showCreateForm = false;
    this.isSubmitting = false;
  }

  editDeal(deal: Deal) {
    this.selectedDeal = { ...deal };
    this.dealForm.patchValue(deal);
    this.imagePreviewUrl = deal.image ? this.getImageUrl(deal.image) : null;
    this.showEditModal = true;
  }

  updateDeal() {
    if (!this.selectedDeal || this.dealForm.invalid) {
      this.error = 'Please fill all required fields';
      return;
    }

    this.isSubmitting = true;
    const dealData = { ...this.dealForm.value };

    if (this.selectedFile && this.imagePreviewUrl) {
      dealData.image = this.imagePreviewUrl;
    }

    this.http.put<any>(
      `http://localhost:8080/api/ecommerce/deals/${this.selectedDeal.id}`, dealData
    ).subscribe(
      (response) => {
        const updated = response.data || response;
        const index = this.deals.findIndex(d => d.id === this.selectedDeal!.id);
        if (index > -1) this.deals[index] = updated;
        this.closeModal();
        this.isSubmitting = false;
      },
      (error) => {
        this.error = 'Error updating deal';
        console.error(error);
        this.isSubmitting = false;
      }
    );
  }

  deleteDeal(dealId: number) {
    if (confirm('Are you sure you want to delete this deal?')) {
      this.http.delete(`http://localhost:8080/api/ecommerce/deals/${dealId}`).subscribe(
        () => { this.deals = this.deals.filter(d => d.id !== dealId); },
        (error) => {
          console.error('Error deleting deal:', error);
          this.error = 'Error deleting deal';
        }
      );
    }
  }

  closeModal() {
    this.showEditModal = false;
    this.showCreateForm = false;
    this.selectedDeal = null;
    this.dealForm.reset();
    this.selectedFile = null;
    this.imagePreviewUrl = null;
    this.aiImageUrl = null;
  }

  toggleCreateForm() {
    this.showCreateForm = !this.showCreateForm;
    if (!this.showCreateForm) {
      this.dealForm.reset();
      this.selectedFile = null;
      this.imagePreviewUrl = null;
      this.aiImageUrl = null;
      this.aiDescription = '';
      this.aiError = null;
    }
  }

  onImageSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      this.selectedFile = input.files[0];
      // Manual file overrides AI image
      this.aiImageUrl = null;
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreviewUrl = e.target?.result as string;
      };
      reader.readAsDataURL(this.selectedFile);
    }
  }

  clearImageSelection(): void {
    this.selectedFile = null;
    this.imagePreviewUrl = null;
    this.aiImageUrl = null;
  }

  getImageUrl(imagePath: string): string {
  if (!imagePath) return '';
  if (imagePath.startsWith('http')) return imagePath;
  // ✅ handles both 'uploads/...' and '/uploads/...'
  const clean = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
  return `http://localhost:8080/${clean}`;
}

  formatEnumValue(value: string): string {
    return value.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  uploadDealImage(dealId: number): void {
    const formData = new FormData();
    formData.append('image', this.selectedFile!);

    this.http.post<any>(
      `http://localhost:8080/api/ecommerce/deals/${dealId}/image`, formData
    ).subscribe(
      (response) => {
        const updatedDeal = response.data || response;
        this.deals.push(updatedDeal);
        this.resetCreateForm();
      },
      (error) => {
        console.error('Image upload error:', error.error);
        this.error = 'Deal created but image upload failed';
        this.isSubmitting = false;
        this.loadDeals();
      }
    );
  }
}