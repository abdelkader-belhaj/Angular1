import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';

interface PromoCode {
  id: number;
  code: string;
  discountPercentage: number;
  isActive: boolean;
  timeUsed?: number;
  maxUses?: number;
  createdAt: string;
}

interface User {
  id: number;
  username: string;
  email: string;
}

@Component({
  selector: 'app-promo-section',
  templateUrl: './promo-section.component.html',
  styleUrl: './promo-section.component.css'
})
export class PromoSectionComponent implements OnInit {
  promoCodes: PromoCode[] = [];
  isLoading = true;
  error: string | null = null;
  isGenerating = false;
  selectedCode: PromoCode | null = null;
  showEditModal = false;

  // Send modal properties
  showSendModal = false;
  selectedCodeToSend: PromoCode | null = null;
  users: User[] = [];
  recipientEmail = '';
  isSending = false;
  sendSuccess = false;
  sendError: string | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadPromoCodes();
  }

  loadPromoCodes() {
    this.isLoading = true;
    this.http.get<any>('http://localhost:8080/api/promo-codes').subscribe(
      (data) => {
        this.promoCodes = Array.isArray(data) ? data : data.data || [];
        this.isLoading = false;
      },
      (error) => {
        this.error = 'Failed to load promo codes';
        console.error(error);
        this.isLoading = false;
      }
    );
  }

  generatePromoCode() {
    this.isGenerating = true;
    const newCode: any = {
      discountPercentage: 10,
      isActive: true
    };

    this.http.post<any>('http://localhost:8080/api/promo-codes', newCode).subscribe(
      (response) => {
        const created = response.data || response;
        this.promoCodes.unshift(created);
        this.isGenerating = false;
      },
      (error) => {
        this.error = 'Failed to generate promo code';
        console.error(error);
        this.isGenerating = false;
      }
    );
  }

  editCode(code: PromoCode) {
    this.selectedCode = { ...code };
    this.showEditModal = true;
  }


  deleteCode(codeId: number) {
    if (confirm('Are you sure you want to delete this promo code?')) {
      this.http.delete(`http://localhost:8080/api/promo-codes/${codeId}`).subscribe(
        () => {
          this.promoCodes = this.promoCodes.filter(c => c.id !== codeId);
        },
        (error) => {
          console.error('Error deleting promo code:', error);
        }
      );
    }
  }

  saveCode() {
    if (!this.selectedCode) return;
    
    const codeId = this.selectedCode.id;
    const updatePayload = {
      discountPercentage: this.selectedCode.discountPercentage,
      maxUses: this.selectedCode.maxUses,
      isActive: this.selectedCode.isActive
    };

    console.log('🔵 [saveCode] Sending update for code ID:', codeId);
    console.log('🔵 [saveCode] Payload being sent:', updatePayload);
    console.log('🔵 [saveCode] isActive value:', this.selectedCode.isActive, 'Type:', typeof this.selectedCode.isActive);

    // Send PUT request to update the code
    this.http.put<any>(`http://localhost:8080/api/promo-codes/${codeId}`, updatePayload).subscribe(
      (response) => {
        console.log('✅ [saveCode] Response received:', response);
        const updated = response.data || response;
        console.log('✅ [saveCode] Updated code from backend:', updated);
        const index = this.promoCodes.findIndex(c => c.id === codeId);
        if (index > -1) {
          this.promoCodes[index] = updated;
          console.log('✅ [saveCode] Updated local array at index', index);
        }
        this.showEditModal = false;
        this.selectedCode = null;
      },
      (error) => {
        console.error('❌ [saveCode] Error updating promo code:', error);
        console.error('❌ [saveCode] Error response:', error.error);
      }
    );
  }

  closeModal() {
    this.showEditModal = false;
    this.selectedCode = null;
  }

  copyToClipboard(code: string) {
    navigator.clipboard.writeText(code);
  }

  toggleCodeStatus(code: PromoCode) {
  const newStatus = !code.isActive;
  console.log('Sending PATCH:', { id: code.id, isActive: newStatus });
  
  this.http.patch<any>(`http://localhost:8080/api/promo-codes/${code.id}`, { isActive: newStatus }).subscribe({
    next: (response) => {
      console.log('PATCH response:', response);
      code.isActive = newStatus;
    },
    error: (err) => {
      console.error('PATCH error:', err);
    }
  });
}

  openSendModal(code: PromoCode): void {
    this.selectedCodeToSend = code;
    this.recipientEmail = '';
    this.sendSuccess = false;
    this.sendError = null;
    this.showSendModal = true;
    this.loadUsers();
  }

  loadUsers(): void {
    this.http.get<any>('http://localhost:8080/api/users/role/CLIENT_TOURISTE').subscribe({
      next: (data) => {
        this.users = Array.isArray(data) ? data : data.data || [];
      },
      error: (err) => console.error('Failed to load users:', err)
    });
  }

  selectUser(user: User): void {
    this.recipientEmail = user.email;
  }

  sendPromoCode(): void {
    if (!this.selectedCodeToSend || !this.recipientEmail.trim()) return;

    this.isSending = true;
    this.sendError = null;

    this.http.post<any>(
      `http://localhost:8080/api/promo-codes/${this.selectedCodeToSend.id}/send`,
      { email: this.recipientEmail }
    ).subscribe({
      next: (response) => {
        const updated = response.data || response;
        // Update local list — code may now be active
        const index = this.promoCodes.findIndex(c => c.id === this.selectedCodeToSend!.id);
        if (index > -1) this.promoCodes[index] = updated;
        this.sendSuccess = true;
        this.isSending = false;
      },
      error: (err) => {
        this.sendError = 'Échec de l\'envoi. Vérifiez l\'adresse email.';
        console.error(err);
        this.isSending = false;
      }
    });
  }

  closeSendModal(): void {
    this.showSendModal = false;
    this.selectedCodeToSend = null;
    this.recipientEmail = '';
    this.sendSuccess = false;
    this.sendError = null;
  }
}
