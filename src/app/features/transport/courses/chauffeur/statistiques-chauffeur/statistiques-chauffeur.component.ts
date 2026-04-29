import { Component, OnInit } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AuthService } from '../../../../../services/auth.service';
import {
  ChauffeurDashboardStats,
  Course,
  WalletTransaction,
} from '../../../core/models';
import { ChauffeurService } from '../../../core/services/chauffeur.service';
import { WalletService } from '../../../core/services/wallet.service';

interface MonthlyPoint {
  label: string;
  revenus: number;
  courses: number;
}

interface DailyRevenuePoint {
  key: string;
  label: string;
  revenus: number;
}

interface HourlyPoint {
  hour: string;
  courses: number;
}

interface ServiceSplit {
  label: string;
  value: number;
  color: string;
}

interface RatingSplit {
  star: number;
  count: number;
  ratio: number;
}

interface RecentComment {
  author: string;
  note: number;
  commentaire: string;
  dateLabel: string;
}

interface DemandZone {
  label: string;
  count: number;
  ratio: number;
}

interface FinancialRow {
  dateLabel: string;
  prixCourse: number;
  commission: number;
  gainNet: number;
}

type PeriodFilter = 'day' | 'week' | 'month';

@Component({
  selector: 'app-statistiques-chauffeur',
  templateUrl: './statistiques-chauffeur.component.html',
  styleUrls: ['./statistiques-chauffeur.component.css'],
})
export class StatistiquesChauffeurComponent implements OnInit {
  private static readonly PLATFORM_COMMISSION_RATE = 0.2;

  isLoading = false;
  error = '';

  chauffeurId: number | null = null;
  periodFilter: PeriodFilter = 'week';

  stats: ChauffeurDashboardStats = {
    totalCoursesAujourdhui: 0,
    totalCoursesSemaine: 0,
    revenusAujourdhui: 0,
    revenusSemaine: 0,
    noteMoyenne: 0,
    tempsEnLigneMinutes: 0,
  };

  totalCourses = 0;
  totalCompletedCourses = 0;
  totalCancelledCourses = 0;
  totalAcceptedDemandes = 0;
  totalReceivedDemandes = 0;

  netRevenueTotal = 0;

  monthlyPoints: MonthlyPoint[] = [];
  dailyRevenuePoints: DailyRevenuePoint[] = [];
  hourlyPoints: HourlyPoint[] = [];
  serviceSplit: ServiceSplit[] = [];
  ratingSplit: RatingSplit[] = [];
  recentComments: RecentComment[] = [];
  demandZones: DemandZone[] = [];

  walletTransactions: WalletTransaction[] = [];
  availableBalance = 0;
  financialRows: FinancialRow[] = [];
  allCourses: Course[] = [];

  constructor(
    private readonly authService: AuthService,
    private readonly chauffeurService: ChauffeurService,
    private readonly walletService: WalletService,
  ) {}

  ngOnInit(): void {
    this.loadStatistics();
  }

  get averageTicket(): number {
    if (!this.totalCompletedCourses) {
      return 0;
    }
    return this.netRevenueTotal / this.totalCompletedCourses;
  }

  get totalRevenue(): number {
    return this.monthlyPoints.reduce((sum, point) => sum + point.revenus, 0);
  }

  get coursesForSelectedPeriod(): number {
    if (!this.allCourses.length) {
      return 0;
    }

    const start = this.getPeriodStart(this.periodFilter);
    return this.allCourses.filter((course) => {
      if (!this.isCompletedCourse(course)) {
        return false;
      }

      const date = this.extractCourseDate(course);
      return !!date && date >= start;
    }).length;
  }

  get acceptanceRate(): number {
    if (!this.totalReceivedDemandes) {
      return 0;
    }

    return (this.totalAcceptedDemandes / this.totalReceivedDemandes) * 100;
  }

  get periodLabel(): string {
    switch (this.periodFilter) {
      case 'day':
        return 'Jour';
      case 'month':
        return 'Mois';
      case 'week':
      default:
        return 'Semaine';
    }
  }

  get barMaxRevenue(): number {
    const max = Math.max(
      ...this.monthlyPoints.map((point) => point.revenus),
      0,
    );
    return max > 0 ? max : 1;
  }

  get chartPolylinePoints(): string {
    if (!this.monthlyPoints.length) {
      return '0,120';
    }

    const width = 560;
    const height = 120;
    const max = this.barMaxRevenue;
    const step =
      this.monthlyPoints.length > 1
        ? width / (this.monthlyPoints.length - 1)
        : width;

    return this.monthlyPoints
      .map((point, index) => {
        const x = step * index;
        const y = height - (point.revenus / max) * (height - 10);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  get dailyRevenuePolyline(): string {
    if (!this.dailyRevenuePoints.length) {
      return '0,120';
    }

    const width = 620;
    const height = 140;
    const max = Math.max(
      ...this.dailyRevenuePoints.map((point) => point.revenus),
      1,
    );
    const step =
      this.dailyRevenuePoints.length > 1
        ? width / (this.dailyRevenuePoints.length - 1)
        : width;

    return this.dailyRevenuePoints
      .map((point, index) => {
        const x = step * index;
        const y = height - (point.revenus / max) * (height - 12);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  get dailyRevenueMax(): number {
    const max = Math.max(
      ...this.dailyRevenuePoints.map((point) => point.revenus),
      0,
    );
    return max > 0 ? max : 1;
  }

  get hourlyCoursesMax(): number {
    const max = Math.max(...this.hourlyPoints.map((point) => point.courses), 0);
    return max > 0 ? max : 1;
  }

  get pieChartGradient(): string {
    const total = this.serviceSplit.reduce((sum, item) => sum + item.value, 0);
    if (!total) {
      return 'conic-gradient(#dbe4f0 0deg 360deg)';
    }

    let currentDeg = 0;
    const slices = this.serviceSplit.map((item) => {
      const sweep = (item.value / total) * 360;
      const start = currentDeg;
      currentDeg += sweep;
      return `${item.color} ${start.toFixed(1)}deg ${currentDeg.toFixed(1)}deg`;
    });

    return `conic-gradient(${slices.join(', ')})`;
  }

  get ratingMax(): number {
    const max = Math.max(...this.ratingSplit.map((item) => item.count), 0);
    return max > 0 ? max : 1;
  }

  get hasDemandZoneData(): boolean {
    return this.demandZones.length > 0;
  }

  get hasRecentComments(): boolean {
    return this.recentComments.length > 0;
  }

  get statusBars(): Array<{ label: string; value: number; ratio: number }> {
    const total = this.totalCourses || 1;
    return [
      {
        label: 'Terminées',
        value: this.totalCompletedCourses,
        ratio: this.totalCompletedCourses / total,
      },
      {
        label: 'Annulées',
        value: this.totalCancelledCourses,
        ratio: this.totalCancelledCourses / total,
      },
      {
        label: 'Autres statuts',
        value: Math.max(
          this.totalCourses -
            this.totalCompletedCourses -
            this.totalCancelledCourses,
          0,
        ),
        ratio:
          Math.max(
            this.totalCourses -
              this.totalCompletedCourses -
              this.totalCancelledCourses,
            0,
          ) / total,
      },
    ];
  }

  private loadStatistics(): void {
    const userId = this.authService.getCurrentUser()?.id;
    if (!userId) {
      this.error = 'Aucune session détectée.';
      return;
    }

    this.isLoading = true;
    this.error = '';

    this.chauffeurService
      .resolveChauffeurIdByUserId(userId)
      .pipe(
        switchMap((chauffeurId) => {
          this.chauffeurId = chauffeurId;
          if (!chauffeurId) {
            this.error = 'Profil chauffeur introuvable.';
            return of(null);
          }

          return forkJoin({
            stats: this.chauffeurService.getDashboardStats(chauffeurId).pipe(
              catchError(() =>
                of({
                  totalCoursesAujourdhui: 0,
                  totalCoursesSemaine: 0,
                  revenusAujourdhui: 0,
                  revenusSemaine: 0,
                  noteMoyenne: 0,
                  tempsEnLigneMinutes: 0,
                }),
              ),
            ),
            courses: this.chauffeurService
              .getHistoriqueCourses(chauffeurId)
              .pipe(catchError(() => of([] as Course[]))),
            transactions: this.walletService
              .getChauffeurTransactions(chauffeurId)
              .pipe(catchError(() => of([] as WalletTransaction[]))),
          });
        }),
        finalize(() => (this.isLoading = false)),
      )
      .subscribe({
        next: (payload) => {
          if (!payload) {
            return;
          }
          this.stats = payload.stats;
          this.walletTransactions = payload.transactions ?? [];
          this.processCourses(payload.courses ?? []);
          this.processWallet();
        },
        error: (error) => {
          this.error =
            error?.message || 'Impossible de charger les statistiques.';
        },
      });
  }

  private processCourses(courses: Course[]): void {
    this.allCourses = courses;
    this.totalCourses = courses.length;

    const completed = courses.filter((course) =>
      this.isCompletedCourse(course),
    );

    this.totalCompletedCourses = completed.length;
    this.totalCancelledCourses = courses.filter(
      (course) => String(course.statut || '').toUpperCase() === 'CANCELLED',
    ).length;

    this.totalAcceptedDemandes = courses.filter(
      (course) => String(course.statut || '').toUpperCase() !== 'CANCELLED',
    ).length;
    this.totalReceivedDemandes = courses.length;

    this.netRevenueTotal = completed.reduce(
      (sum, course) => sum + this.extractNetAmount(course),
      0,
    );

    this.monthlyPoints = this.buildMonthlySeries(completed);
    this.dailyRevenuePoints = this.buildDailyRevenueSeries(completed);
    this.hourlyPoints = this.buildHourlySeries(completed);
    this.serviceSplit = this.buildServiceSplit(courses);
    this.ratingSplit = this.buildRatingSplit(courses);
    this.recentComments = this.buildRecentComments(courses);
    this.demandZones = this.buildDemandZones(courses);
    this.financialRows = this.buildFinancialRows(completed);
  }

  private buildMonthlySeries(completedCourses: Course[]): MonthlyPoint[] {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const now = new Date();
    const baseMonths: Array<{ key: string; date: Date }> = [];

    for (let i = 5; i >= 0; i -= 1) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      baseMonths.push({ key, date });
    }

    const bucket = new Map<string, MonthlyPoint>();
    baseMonths.forEach(({ key, date }) => {
      bucket.set(key, {
        label: formatter.format(date),
        revenus: 0,
        courses: 0,
      });
    });

    completedCourses.forEach((course) => {
      const date = this.extractCourseDate(course);
      if (!date) {
        return;
      }
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const item = bucket.get(key);
      if (!item) {
        return;
      }

      item.revenus += this.extractNetAmount(course);
      item.courses += 1;
    });

    return baseMonths.map(({ key }) => bucket.get(key)!);
  }

  private buildDailyRevenueSeries(
    completedCourses: Course[],
  ): DailyRevenuePoint[] {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
    });
    const days: Array<{ key: string; date: Date }> = [];

    for (let i = 29; i >= 0; i -= 1) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      date.setHours(0, 0, 0, 0);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      days.push({ key, date });
    }

    const bucket = new Map<string, DailyRevenuePoint>();
    days.forEach(({ key, date }) => {
      bucket.set(key, {
        key,
        label: formatter.format(date),
        revenus: 0,
      });
    });

    completedCourses.forEach((course) => {
      const date = this.extractCourseDate(course);
      if (!date) {
        return;
      }

      const day = new Date(date);
      day.setHours(0, 0, 0, 0);
      const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;

      const point = bucket.get(key);
      if (!point) {
        return;
      }

      point.revenus += this.extractNetAmount(course);
    });

    return days.map(({ key }) => bucket.get(key)!);
  }

  private buildHourlySeries(completedCourses: Course[]): HourlyPoint[] {
    const hourCounts = Array.from({ length: 24 }, () => 0);

    completedCourses.forEach((course) => {
      const date = this.extractCourseDate(course);
      if (!date) {
        return;
      }

      const hour = date.getHours();
      hourCounts[hour] += 1;
    });

    return hourCounts.map((count, hour) => ({
      hour: `${String(hour).padStart(2, '0')}h`,
      courses: count,
    }));
  }

  private buildServiceSplit(courses: Course[]): ServiceSplit[] {
    const palette: Record<string, string> = {
      ECONOMY: '#1f5eac',
      PREMIUM: '#f09f1e',
      VAN: '#24a46d',
      AUTRE: '#7b88a8',
    };

    const labels: Record<string, string> = {
      ECONOMY: 'Taxi VTC',
      PREMIUM: 'Premium',
      VAN: 'Van / Groupe',
      AUTRE: 'Autres',
    };

    const counts = new Map<string, number>();
    courses.forEach((course) => {
      const rawType =
        String(
          (course as any)?.demande?.typeVehiculeDemande ||
            (course as any)?.vehicule?.typeVehicule ||
            'AUTRE',
        )
          .toUpperCase()
          .trim() || 'AUTRE';

      const normalized = ['ECONOMY', 'PREMIUM', 'VAN'].includes(rawType)
        ? rawType
        : 'AUTRE';
      counts.set(normalized, (counts.get(normalized) || 0) + 1);
    });

    return Array.from(counts.entries())
      .map(([key, value]) => ({
        label: labels[key] || key,
        value,
        color: palette[key] || palette['AUTRE'],
      }))
      .sort((a, b) => b.value - a.value);
  }

  private buildRatingSplit(courses: Course[]): RatingSplit[] {
    const ratingCount = new Map<number, number>();

    courses.forEach((course) => {
      const evaluations = (course as any)?.evaluationTransports || [];
      if (!Array.isArray(evaluations)) {
        return;
      }

      evaluations.forEach((evaluation: any) => {
        const note = Number(evaluation?.note ?? 0);
        const star = Math.round(note);
        if (!Number.isFinite(star) || star < 1 || star > 5) {
          return;
        }

        ratingCount.set(star, (ratingCount.get(star) || 0) + 1);
      });
    });

    const total = Array.from(ratingCount.values()).reduce(
      (sum, value) => sum + value,
      0,
    );

    return [5, 4, 3, 2, 1].map((star) => {
      const count = ratingCount.get(star) || 0;
      return {
        star,
        count,
        ratio: total ? count / total : 0,
      };
    });
  }

  private buildRecentComments(courses: Course[]): RecentComment[] {
    const comments: Array<{ date: Date; item: RecentComment }> = [];

    courses.forEach((course) => {
      const evaluations = (course as any)?.evaluationTransports || [];
      if (!Array.isArray(evaluations)) {
        return;
      }

      evaluations.forEach((evaluation: any) => {
        const commentaire = String(
          evaluation?.commentaire ?? evaluation?.comment ?? '',
        ).trim();
        if (!commentaire) {
          return;
        }

        const note = Number(evaluation?.note ?? 0);
        const safeNote = Number.isFinite(note)
          ? Math.max(1, Math.min(5, note))
          : 0;
        const rawDate =
          evaluation?.dateCreation ||
          course.dateModification ||
          course.dateCreation;
        const date = rawDate ? new Date(rawDate) : new Date();
        const dateLabel = Number.isNaN(date.getTime())
          ? '-'
          : date.toLocaleDateString('fr-FR');

        comments.push({
          date,
          item: {
            author: evaluation?.evaluateurNom || 'Client',
            note: safeNote,
            commentaire,
            dateLabel,
          },
        });
      });
    });

    return comments
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, 8)
      .map((entry) => entry.item);
  }

  private buildDemandZones(courses: Course[]): DemandZone[] {
    const counts = new Map<string, number>();

    courses.forEach((course) => {
      const location = (course as any)?.localisationDepart;
      const adresse = String(
        location?.adresse ||
          location?.address ||
          (location?.latitude && location?.longitude
            ? `${Number(location.latitude).toFixed(2)}, ${Number(location.longitude).toFixed(2)}`
            : ''),
      ).trim();

      if (!adresse) {
        return;
      }

      counts.set(adresse, (counts.get(adresse) || 0) + 1);
    });

    const ranked = Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const max = Math.max(...ranked.map((item) => item.count), 1);
    return ranked.map((item) => ({
      label: item.label,
      count: item.count,
      ratio: item.count / max,
    }));
  }

  private processWallet(): void {
    const sorted = [...this.walletTransactions].sort((left, right) => {
      const leftDate = new Date(left.dateTransaction || 0).getTime();
      const rightDate = new Date(right.dateTransaction || 0).getTime();
      return rightDate - leftDate;
    });

    this.availableBalance = sorted.reduce((sum, tx) => {
      const amount = Number(tx.montant ?? 0);
      const type = String(tx.type || '').toUpperCase();
      return type.startsWith('DEBIT') ? sum - amount : sum + amount;
    }, 0);
  }

  private buildFinancialRows(completedCourses: Course[]): FinancialRow[] {
    return [...completedCourses]
      .sort((left, right) => {
        const leftTime = this.extractCourseDate(left)?.getTime() || 0;
        const rightTime = this.extractCourseDate(right)?.getTime() || 0;
        return rightTime - leftTime;
      })
      .slice(0, 8)
      .map((course) => {
        const total = this.extractGrossAmount(course);
        const commission = this.extractCommissionAmount(course, total);
        const net = this.extractNetAmount(course);
        const date = this.extractCourseDate(course);

        return {
          dateLabel: date
            ? date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })
            : '-',
          prixCourse: total,
          commission,
          gainNet: net,
        };
      });
  }

  private extractNetAmount(course: Course): number {
    const directNet = Number((course as any)?.paiementTransport?.montantNet);
    if (Number.isFinite(directNet) && directNet > 0) {
      return directNet;
    }

    const gross = this.extractGrossAmount(course);
    if (gross <= 0) {
      return 0;
    }

    const commission = this.extractCommissionAmount(course, gross);
    const computed = gross - commission;
    return computed > 0 ? computed : 0;
  }

  private extractGrossAmount(course: Course): number {
    const candidates = [
      Number((course as any)?.paiementTransport?.montantTotal),
      Number((course as any)?.prixFinal),
      Number((course as any)?.prixEstime),
    ];

    const found = candidates.find(
      (value) => Number.isFinite(value) && value > 0,
    );
    return found || 0;
  }

  private extractCommissionAmount(course: Course, grossAmount: number): number {
    const explicit = Number(
      (course as any)?.montantCommission ||
        (course as any)?.paiementTransport?.montantCommission ||
        0,
    );

    if (Number.isFinite(explicit) && explicit > 0) {
      return explicit;
    }

    return (
      Math.round(
        grossAmount *
          StatistiquesChauffeurComponent.PLATFORM_COMMISSION_RATE *
          100,
      ) / 100
    );
  }

  private isCompletedCourse(course: Course): boolean {
    const status = String(course.statut || '').toUpperCase();
    return status === 'COMPLETED' || !!course.paiementTransport?.datePaiement;
  }

  private getPeriodStart(period: PeriodFilter): Date {
    const now = new Date();
    const start = new Date(now);

    if (period === 'day') {
      start.setHours(0, 0, 0, 0);
      return start;
    }

    if (period === 'month') {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      return start;
    }

    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  private extractCourseDate(course: Course): Date | null {
    const candidates = [
      course.paiementTransport?.datePaiement,
      course.dateModification,
      course.dateCreation,
    ];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }
      const parsed = new Date(candidate);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return null;
  }
}
