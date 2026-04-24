import { Component, OnInit } from '@angular/core';
import { finalize } from 'rxjs/operators';
import { jsPDF } from 'jspdf';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { WalletService } from '../../../core/services/wallet.service';
import { WalletTransaction, TransactionType } from '../../../core/models';
import { AuthService } from '../../../../../services/auth.service';

@Component({
  selector: 'app-portefeuille-chauffeur',
  templateUrl: './portefeuille-chauffeur.component.html',
  styleUrls: ['./portefeuille-chauffeur.component.css'],
})
export class PortefeuilleChauffeurComponent implements OnInit {
  chauffeurId: number | null = null;
  transactions: WalletTransaction[] = [];
  isLoading = false;
  error = '';
  actionNotice = '';
  searchTerm = '';

  constructor(
    private readonly chauffeurService: ChauffeurService,
    private readonly walletService: WalletService,
    private readonly authService: AuthService,
  ) {}

  ngOnInit(): void {
    const userId = this.authService.getCurrentUser()?.id;

    if (!userId) {
      this.error = 'Aucune session détectée.';
      return;
    }

    this.isLoading = true;
    this.chauffeurService
      .resolveChauffeurIdByUserId(userId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (chauffeurId) => {
          this.chauffeurId = chauffeurId;

          if (!this.chauffeurId) {
            this.error = 'Profil chauffeur introuvable.';
            return;
          }

          this.loadTransactions(this.chauffeurId);
        },
        error: (error) => {
          this.error = error?.message || 'Impossible de résoudre le chauffeur.';
        },
      });
  }

  private loadTransactions(chauffeurId: number): void {
    this.isLoading = true;
    this.walletService
      .getChauffeurTransactions(chauffeurId)
      .pipe(finalize(() => (this.isLoading = false)))
      .subscribe({
        next: (transactions) => {
          this.transactions = transactions ?? [];
        },
        error: (error) => {
          this.transactions = [];
          this.error =
            error?.message ||
            'Impossible de charger les transactions chauffeur.';
        },
      });
  }

  get totalCredits(): number {
    return this.transactions
      .filter((t) => this.isCreditType(t.type))
      .reduce((sum, t) => sum + Number(t.montant ?? 0), 0);
  }

  get totalDebits(): number {
    return this.transactions
      .filter((t) => this.isDebitType(t.type))
      .reduce((sum, t) => sum + Number(t.montant ?? 0), 0);
  }

  get netBalance(): number {
    return this.totalCredits - this.totalDebits;
  }

  get filteredTransactions(): WalletTransaction[] {
    const query = this.searchTerm.trim().toLowerCase();
    if (!query) {
      return this.transactions;
    }

    return this.transactions.filter((tx) => {
      const dateValue = tx.dateTransaction
        ? new Date(tx.dateTransaction).toLocaleString('fr-FR')
        : '';
      const amountValue = Number(tx.montant ?? 0).toFixed(2);
      const typeValue = this.getTypeLabel(tx.type);
      const description = tx.description ?? '';

      return [dateValue, amountValue, typeValue, description]
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }

  getTypeLabel(type: TransactionType): string {
    const value = String(type || '').toUpperCase();
    switch (value) {
      case 'CREDIT_COURSE':
        return 'Crédit course';
      case 'CREDIT_RESERVATION':
        return 'Crédit réservation';
      case 'CREDIT_COMMISSION':
        return 'Crédit commission';
      case 'DEBIT_PAYOUT':
        return 'Débit payout';
      default:
        return value || 'Inconnu';
    }
  }

  private isCreditType(type: TransactionType): boolean {
    return String(type || '')
      .toUpperCase()
      .startsWith('CREDIT');
  }

  private isDebitType(type: TransactionType): boolean {
    return String(type || '')
      .toUpperCase()
      .startsWith('DEBIT');
  }

  isCredit(type: TransactionType): boolean {
    return this.isCreditType(type);
  }

  onExportPdf(): void {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 12;
    const contentWidth = pageWidth - marginX * 2;
    const maxY = pageHeight - 14;
    const rows = this.filteredTransactions;
    let y = 0;

    const formatAmount = (value: number) => `${value.toFixed(2)} TND`;
    const ensureSpace = (neededHeight: number) => {
      if (y + neededHeight <= maxY) {
        return;
      }
      doc.addPage();
      y = 16;
      drawPageHeader(false);
    };

    const drawPageHeader = (firstPage: boolean) => {
      if (firstPage) {
        doc.setFillColor(0, 57, 116);
        doc.roundedRect(marginX, 12, contentWidth, 24, 2, 2, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(15);
        doc.text('Portefeuille Chauffeur', marginX + 5, 22);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.text('Historique des transactions', marginX + 5, 28);
        doc.text(
          `Date export: ${new Date().toLocaleString('fr-FR')}`,
          pageWidth - marginX - 5,
          22,
          { align: 'right' },
        );
        doc.text(
          `Filtre actif: ${this.searchTerm.trim() || 'Aucun'}`,
          pageWidth - marginX - 5,
          28,
          { align: 'right' },
        );

        y = 44;
      } else {
        doc.setTextColor(0, 57, 116);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Portefeuille Chauffeur - Suite', marginX, 16);
        y = 22;
      }
      doc.setTextColor(25, 28, 30);
    };

    const drawSummaryCards = () => {
      const gap = 4;
      const cardW = (contentWidth - gap * 3) / 4;
      const cardH = 22;
      const summary = [
        {
          title: 'Credits',
          value: formatAmount(this.totalCredits),
          color: [22, 101, 52] as const,
        },
        {
          title: 'Debits',
          value: formatAmount(this.totalDebits),
          color: [153, 27, 27] as const,
        },
        {
          title: 'Solde net',
          value: formatAmount(this.netBalance),
          color: [0, 57, 116] as const,
        },
        {
          title: 'Transactions',
          value: String(rows.length),
          color: [66, 71, 81] as const,
        },
      ];

      summary.forEach((item, index) => {
        const x = marginX + index * (cardW + gap);
        doc.setFillColor(247, 249, 252);
        doc.setDrawColor(216, 223, 239);
        doc.roundedRect(x, y, cardW, cardH, 2, 2, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(98, 112, 132);
        doc.text(item.title, x + 3, y + 6);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(item.color[0], item.color[1], item.color[2]);
        doc.text(item.value, x + 3, y + 14);
      });

      doc.setTextColor(25, 28, 30);
      y += cardH + 8;
    };

    const drawTableHeader = () => {
      const columns = {
        date: 34,
        type: 42,
        desc: 72,
        amount: 28,
      };

      doc.setFillColor(236, 238, 241);
      doc.rect(marginX, y, contentWidth, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(66, 71, 81);

      let x = marginX + 2;
      doc.text('Date', x, y + 5.3);
      x += columns.date;
      doc.text('Type', x, y + 5.3);
      x += columns.type;
      doc.text('Description', x, y + 5.3);
      x += columns.desc;
      doc.text('Montant', x + columns.amount, y + 5.3, { align: 'right' });

      y += 9;
      doc.setTextColor(25, 28, 30);
    };

    drawPageHeader(true);
    drawSummaryCards();

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text('Transactions', marginX, y);
    y += 6;

    drawTableHeader();

    if (!rows.length) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(114, 119, 130);
      doc.text('Aucune transaction pour ce filtre.', marginX + 2, y + 5);
      y += 12;
    } else {
      const colDate = 34;
      const colType = 42;
      const colDesc = 72;
      const colAmount = 28;

      rows.forEach((tx, index) => {
        const dateText = tx.dateTransaction
          ? new Date(tx.dateTransaction).toLocaleString('fr-FR')
          : '-';
        const typeText = this.getTypeLabel(tx.type);
        const amountText = `${this.isCredit(tx.type) ? '+' : '-'} ${formatAmount(Number(tx.montant ?? 0))}`;
        const descLines = doc.splitTextToSize(
          tx.description || '-',
          colDesc - 2,
        );
        const rowH = Math.max(8, descLines.length * 4 + 2);

        ensureSpace(rowH + 1);

        if (index % 2 === 0) {
          doc.setFillColor(250, 251, 253);
          doc.rect(marginX, y - 1, contentWidth, rowH, 'F');
        }

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        let x = marginX + 2;
        doc.setTextColor(66, 71, 81);
        doc.text(dateText, x, y + 4);
        x += colDate;

        doc.setTextColor(25, 28, 30);
        doc.text(typeText, x, y + 4);
        x += colType;

        doc.setTextColor(51, 65, 85);
        doc.text(descLines, x, y + 4);
        x += colDesc;

        if (this.isCredit(tx.type)) {
          doc.setTextColor(22, 101, 52);
        } else {
          doc.setTextColor(153, 27, 27);
        }
        doc.setFont('helvetica', 'bold');
        doc.text(amountText, x + colAmount, y + 4, { align: 'right' });

        y += rowH;
      });
    }

    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i += 1) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(114, 119, 130);
      doc.text(`Page ${i}/${totalPages}`, pageWidth - marginX, pageHeight - 6, {
        align: 'right',
      });
    }

    doc.save(
      `portefeuille-chauffeur-${new Date().toISOString().slice(0, 10)}.pdf`,
    );

    this.actionNotice = 'Export PDF effectué avec succès.';
  }

  onNewWithdrawal(): void {
    this.actionNotice =
      'Demande de retrait enregistrée. Le flux complet sera activé bientôt.';
  }
}
