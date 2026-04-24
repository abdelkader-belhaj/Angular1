import { Injectable } from '@angular/core';
import { EvaluationTransport, TypeVehicule } from '../models';

export interface SmartReviewSummary {
  title: string;
  subtitle: string;
  summary: string;
  highlights: string[];
  concerns: string[];
  averageNote: number;
  sourceCount: number;
  confidence: string;
}

export interface SmartReviewSummaryApiLike {
  summary?: string;
  nombreAvis?: number;
  nombre_avis?: number;
  averageNote?: number;
  average_note?: number;
  highlights?: string[];
  concerns?: string[];
  confidence?: string;
}

type ReviewLike = Partial<EvaluationTransport> & {
  note?: number;
  commentaire?: string;
  comment?: string;
  score?: number;
};

interface TopicDefinition {
  label: string;
  positiveKeywords: string[];
  negativeKeywords: string[];
}

interface TopicScore {
  label: string;
  positive: number;
  negative: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewSummaryService {
  private readonly topics: TopicDefinition[] = [
    {
      label: 'la propreté du véhicule',
      positiveKeywords: ['propre', 'proprete', 'impeccable', 'net', 'nettoye'],
      negativeKeywords: ['sale', 'salet', 'poussiere', 'odeur'],
    },
    {
      label: 'la connaissance locale du chauffeur',
      positiveKeywords: [
        'histoire',
        'historique',
        'guide',
        'anecdote',
        'local',
      ],
      negativeKeywords: ['ignore', 'aucune information', 'muet'],
    },
    {
      label: 'le confort à bord',
      positiveKeywords: ['confort', 'spacieux', 'agréable', 'agrable', 'siege'],
      negativeKeywords: ['serre', 'etroit', 'inconfort', 'fatiguant'],
    },
    {
      label: 'la ponctualité',
      positiveKeywords: ['ponctuel', 'a l heure', "à l'heure", 'rapide'],
      negativeKeywords: ['retard', 'attente', 'tardif', 'en retard'],
    },
    {
      label: 'la conduite souple',
      positiveKeywords: [
        'conduite souple',
        'prudence',
        'doux',
        'calme',
        'serein',
      ],
      negativeKeywords: ['brutal', 'agressif', 'secousses', 'freinage'],
    },
    {
      label: 'la climatisation',
      positiveKeywords: ['climatisation', 'clim', 'air frais', 'frais'],
      negativeKeywords: ['clim faible', 'chaud', 'insuffisant', 'trop chaud'],
    },
    {
      label: 'le rapport qualité-prix',
      positiveKeywords: ['prix', 'tarif', 'bon rapport', 'raisonnable'],
      negativeKeywords: ['cher', 'coûteux', 'cout', 'trop cher'],
    },
  ];

  buildFromEvaluations(
    reviews: ReviewLike[] = [],
    context = 'ce service',
  ): SmartReviewSummary {
    const normalized = this.normalizeReviews(reviews);
    if (!normalized.length) {
      return this.buildDemoSummary(context);
    }

    return this.buildSummary(normalized, context);
  }

  buildFromAiResponse(
    payload: SmartReviewSummaryApiLike,
    fallbackReviews: ReviewLike[] = [],
    context = 'ce service',
  ): SmartReviewSummary {
    const fallback = this.buildFromEvaluations(fallbackReviews, context);

    const sourceCount = Number(payload?.nombreAvis ?? payload?.nombre_avis);
    const averageNote = Number(payload?.averageNote ?? payload?.average_note);
    const highlights = Array.isArray(payload?.highlights)
      ? payload.highlights.filter((value) => !!String(value || '').trim())
      : [];
    const concerns = Array.isArray(payload?.concerns)
      ? payload.concerns.filter((value) => !!String(value || '').trim())
      : [];
    const resolvedCount =
      Number.isFinite(sourceCount) && sourceCount > 0
        ? Number(sourceCount)
        : fallback.sourceCount;

    return {
      title: this.buildSummaryTitle(context),
      subtitle: this.buildSummarySubtitle(resolvedCount, context),
      summary: String(payload?.summary || '').trim() || fallback.summary,
      highlights: highlights.length ? highlights : fallback.highlights,
      concerns: concerns.length ? concerns : fallback.concerns,
      averageNote:
        Number.isFinite(averageNote) && averageNote > 0
          ? Number(averageNote.toFixed(1))
          : fallback.averageNote,
      sourceCount: resolvedCount,
      confidence:
        String(payload?.confidence || '').trim() || fallback.confidence,
    };
  }

  buildDemoSummary(context = 'ce trajet'): SmartReviewSummary {
    const demoReviews: ReviewLike[] = [
      {
        note: 5,
        commentaire:
          'Véhicule impeccable, chauffeur très accueillant et riche en anecdotes locales.',
      },
      {
        note: 4,
        commentaire:
          'Trajet confortable et ponctuel, mais la climatisation pourrait être un peu plus forte.',
      },
      {
        note: 5,
        commentaire:
          'Service premium, conduite souple et bonnes explications sur les sites à visiter.',
      },
      {
        note: 4,
        commentaire:
          'Très bon rapport qualité-prix, véhicule propre, attente légèrement longue au départ.',
      },
    ];

    return this.buildSummary(this.normalizeReviews(demoReviews), context);
  }

  buildVehicleTypeSummary(type: TypeVehicule): SmartReviewSummary {
    const templates: Record<TypeVehicule, ReviewLike[]> = {
      [TypeVehicule.ECONOMY]: [
        {
          note: 4,
          commentaire:
            'Service propre et efficace, avec un bon rapport qualité-prix pour les trajets courts.',
        },
        {
          note: 4,
          commentaire:
            'Chauffeur ponctuel, conduite douce, climatisation correcte malgré la chaleur.',
        },
        {
          note: 5,
          commentaire:
            'Très rassurant pour les voyageurs, véhicule bien entretenu et arrivée à l heure.',
        },
      ],
      [TypeVehicule.PREMIUM]: [
        {
          note: 5,
          commentaire:
            'Accueil premium, véhicule impeccable et chauffeur qui partage de vraies connaissances locales.',
        },
        {
          note: 5,
          commentaire:
            'Confort excellent, conduite souple et petite attention sur les lieux historiques du trajet.',
        },
        {
          note: 4,
          commentaire:
            'Expérience très soignée, seule la climatisation mérite parfois un réglage plus frais.',
        },
      ],
      [TypeVehicule.VAN]: [
        {
          note: 5,
          commentaire:
            'Parfait pour les familles, espace généreux, coffre pratique et chauffeur très patient.',
        },
        {
          note: 4,
          commentaire:
            'Véhicule confortable et propre, idéal pour plusieurs bagages et un long transfert.',
        },
        {
          note: 4,
          commentaire:
            'Bonne disponibilité, mais les passagers recommandent de vérifier la climatisation en plein été.',
        },
      ],
    };

    return this.buildSummary(
      this.normalizeReviews(templates[type] ?? templates[TypeVehicule.ECONOMY]),
      this.getVehicleLabel(type),
    );
  }

  private buildSummary(
    reviews: ReviewLike[],
    context: string,
  ): SmartReviewSummary {
    const averageNote = this.computeAverageNote(reviews);
    const topicScores = this.scoreTopics(reviews);
    const positiveTopics = topicScores
      .filter((topic) => topic.positive > topic.negative)
      .sort(
        (left, right) =>
          right.positive - left.positive || right.negative - left.negative,
      );
    const concernTopics = topicScores
      .filter((topic) => topic.negative > topic.positive)
      .sort(
        (left, right) =>
          right.negative - left.negative || right.positive - left.positive,
      );

    const positivePhrase = this.formatTopicList(
      positiveTopics.length
        ? positiveTopics
        : this.getFallbackPositiveTopics(averageNote),
      2,
    );
    const concernPhrase = this.formatTopicList(
      concernTopics.length
        ? concernTopics
        : this.getFallbackConcernTopics(averageNote),
      1,
    );

    const summary = this.composeSummary(
      averageNote,
      context,
      positivePhrase,
      concernPhrase,
    );

    const title = this.buildSummaryTitle(context);
    const subtitle = this.buildSummarySubtitle(reviews.length, context);

    const highlights = this.pickTopicLabels(positiveTopics, 'points forts', 3);
    const concerns = this.pickTopicLabels(
      concernTopics,
      'points de vigilance',
      3,
    );

    return {
      title,
      subtitle,
      summary,
      highlights,
      concerns,
      averageNote,
      sourceCount: reviews.length,
      confidence: this.getConfidenceLabel(reviews.length, averageNote),
    };
  }

  private buildSummaryTitle(context: string): string {
    const normalized = this.normalizeText(context || '');

    if (normalized.includes('chauffeur')) {
      return 'Synthese des avis chauffeur';
    }

    if (normalized.includes('vos avis')) {
      return 'Synthese de vos avis clients';
    }

    return 'Synthese des avis';
  }

  private buildSummarySubtitle(sourceCount: number, context: string): string {
    const normalized = this.normalizeText(context || '');

    if (normalized.includes('chauffeur')) {
      return `Analyse de ${sourceCount} avis clients pour ce chauffeur`;
    }

    if (normalized.includes('vos avis')) {
      return `Analyse de ${sourceCount} avis clients`;
    }

    return `Analyse de ${sourceCount} avis`;
  }

  private normalizeReviews(reviews: ReviewLike[]): ReviewLike[] {
    return reviews.filter((review) => {
      const note = Number(review?.note ?? review?.['score']);
      const comment = this.getReviewText(review).trim();
      return Number.isFinite(note) || !!comment;
    });
  }

  private scoreTopics(reviews: ReviewLike[]): TopicScore[] {
    return this.topics.map((topic) => {
      let positive = 0;
      let negative = 0;

      for (const review of reviews) {
        const text = this.normalizeText(this.getReviewText(review));
        if (!text) {
          continue;
        }

        if (this.matchesAny(text, topic.positiveKeywords)) {
          positive += 1;
        }

        if (this.matchesAny(text, topic.negativeKeywords)) {
          negative += 1;
        }
      }

      return {
        label: topic.label,
        positive,
        negative,
      };
    });
  }

  private computeAverageNote(reviews: ReviewLike[]): number {
    const notes = reviews
      .map((review) => Number(review?.note ?? review?.['score']))
      .filter((note) => Number.isFinite(note) && note > 0);

    if (!notes.length) {
      return 4.4;
    }

    const total = notes.reduce((sum, note) => sum + note, 0);
    return Number((total / notes.length).toFixed(1));
  }

  private getConfidenceLabel(sourceCount: number, averageNote: number): string {
    if (sourceCount >= 8 && averageNote >= 4.3) {
      return 'Fiabilite elevee';
    }

    if (sourceCount >= 4) {
      return 'Fiabilite moyenne';
    }

    return 'Fiabilite exploratoire';
  }

  private composeSummary(
    averageNote: number,
    context: string,
    positivePhrase: string,
    concernPhrase: string,
  ): string {
    const contextSuffix = context ? ` pour ${context}` : '';

    if (averageNote >= 4.6) {
      return `Les voyageurs saluent surtout ${positivePhrase}${contextSuffix}. Le service apparaît très solide, avec seulement quelques retours ponctuels sur ${concernPhrase}.`;
    }

    if (averageNote >= 4.1) {
      return `Les voyageurs apprécient surtout ${positivePhrase}${contextSuffix}, tout en signalant parfois ${concernPhrase}.`;
    }

    return `L expérience est plus contrastée${contextSuffix} : ${positivePhrase} ressort, mais ${concernPhrase} revient souvent dans les avis.`;
  }

  private pickTopicLabels(
    topics: TopicScore[],
    fallbackLabel: string,
    limit: number,
  ): string[] {
    const labels = topics
      .slice(0, limit)
      .map((topic) => topic.label)
      .filter((label) => !!label);

    if (labels.length) {
      return labels;
    }

    return [fallbackLabel];
  }

  private formatTopicList(
    topics: TopicScore[] | string[],
    limit: number,
  ): string {
    const labels = (topics as Array<TopicScore | string>)
      .slice(0, limit)
      .map((topic) => (typeof topic === 'string' ? topic : topic.label))
      .filter((label) => !!label);

    if (!labels.length) {
      return 'la qualité globale du service';
    }

    if (labels.length === 1) {
      return labels[0];
    }

    if (labels.length === 2) {
      return `${labels[0]} et ${labels[1]}`;
    }

    const [first, second, ...rest] = labels;
    return `${first}, ${second}${rest.length ? ` et ${rest.join(', ')}` : ''}`;
  }

  private getFallbackPositiveTopics(averageNote: number): TopicScore[] {
    if (averageNote >= 4.6) {
      return [
        { label: 'la propreté du véhicule', positive: 1, negative: 0 },
        {
          label: 'la connaissance locale du chauffeur',
          positive: 1,
          negative: 0,
        },
      ];
    }

    return [
      { label: 'le confort à bord', positive: 1, negative: 0 },
      { label: 'la ponctualité', positive: 1, negative: 0 },
    ];
  }

  private getFallbackConcernTopics(averageNote: number): TopicScore[] {
    if (averageNote >= 4.6) {
      return [
        { label: 'la climatisation un peu faible', positive: 0, negative: 1 },
      ];
    }

    return [{ label: 'les délais de départ', positive: 0, negative: 1 }];
  }

  private getReviewText(review: ReviewLike): string {
    return String(review?.commentaire ?? review?.comment ?? '').trim();
  }

  private normalizeText(text: string): string {
    return String(text || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  private matchesAny(text: string, keywords: string[]): boolean {
    return keywords.some((keyword) =>
      text.includes(this.normalizeText(keyword)),
    );
  }

  private getVehicleLabel(type: TypeVehicule): string {
    switch (type) {
      case TypeVehicule.PREMIUM:
        return 'le véhicule premium';
      case TypeVehicule.VAN:
        return 'le van';
      case TypeVehicule.ECONOMY:
      default:
        return 'le véhicule économique';
    }
  }
}
