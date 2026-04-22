import { DiscountInfo } from '../models/event.model';

export function calculateDiscount(
  price: number,
  startDate: string,
  categoryName?: string | null
): DiscountInfo {
  const d     = new Date(startDate);
  const month = d.getMonth() + 1;
  const day   = d.getDate();
  const dow   = d.getDay(); // 0=dim, 5=ven, 6=sam

  let percent = 0;
  let label   = '';

  // ── Jours fériés ─────────────────────────────────────────────
  if      (month === 2  && day >= 12 && day <= 16) { percent = 20; label = '💝 Saint-Valentin −20%'; }
  else if (month === 12 && day >= 24)               { percent = 15; label = '🎄 Fêtes de fin d\'année −15%'; }
  else if (month === 1  && day === 1)               { percent = 15; label = '🎆 Nouvel An −15%'; }
  else if (month === 7  && day === 25)              { percent = 10; label = '🇹🇳 Fête Nationale −10%'; }
  else if (month === 5  && day === 1)               { percent = 10; label = '🛠️ Fête du Travail −10%'; }
  else if (month === 3  && day === 20)              { percent = 15; label = '🇹🇳 Fête Indépendance −15%'; }
  else if (month === 8  && day === 13)              { percent = 10; label = '🌸 Fête de la Femme −10%'; }
  else {
    // ── Weekend ──────────────────────────────────────────────
    if (dow === 5 || dow === 6 || dow === 0) {
      percent = 5;
      label   = '🎉 Promo Weekend −5%';
    }

    // ── Été (juin-juillet-août) ───────────────────────────────
    const cat = (categoryName ?? '').toLowerCase();
    const isEte = [6, 7, 8].includes(month);
    if (isEte && ['mer', 'festival', 'concert', 'nature', 'détente', 'plage'].some(c => cat.includes(c))) {
      // Été > weekend si les 2 s'appliquent
      if (percent < 10) { percent = 10; label = '☀️ Offre Été −10%'; }
    }

    // ── Dernière minute (< 48h) ───────────────────────────────
    const now     = new Date();
    const diffH   = (d.getTime() - now.getTime()) / 3600000;
    if (diffH > 0 && diffH < 48) {
      percent = 30;
      label   = '⚡ Dernière minute −30%';
    }
  }

  // ── Aïd el-Fitr approx ───────────────────────────────────────
  const aids = [
    { y: 2024, m: 4,  d: 10 },
    { y: 2025, m: 3,  d: 30 },
    { y: 2026, m: 3,  d: 20 },
    { y: 2027, m: 3,  d: 10 },
  ];
  if (aids.some(a =>
    d.getFullYear() === a.y &&
    month === a.m &&
    Math.abs(day - a.d) <= 3
  )) {
    percent = 25;
    label   = '🌙 Aïd el-Fitr −25%';
  }

  // ── Aïd el-Adha approx ───────────────────────────────────────
  const adhas = [
    { y: 2024, m: 6,  d: 16 },
    { y: 2025, m: 6,  d:  6 },
    { y: 2026, m: 5,  d: 27 },
    { y: 2027, m: 5,  d: 17 },
  ];
  if (adhas.some(a =>
    d.getFullYear() === a.y &&
    month === a.m &&
    Math.abs(day - a.d) <= 3
  )) {
    percent = 25;
    label   = '🌙 Aïd el-Adha −25%';
  }

  const finalPrice = percent > 0
    ? +(price * (1 - percent / 100)).toFixed(2)
    : price;

  return {
    hasDiscount:     percent > 0,
    percent,
    discountPercent: percent,
    finalPrice,
    discountedPrice: finalPrice,
    originalPrice:   price,
    label,
    reason: label,
  };
}

export function defaultEventImage(
  type: string,
  categoryName?: string | null
): string {
  const cat = (categoryName ?? '').toLowerCase();

  if (cat.includes('festival') || cat.includes('culture'))
    return 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800';
  if (cat.includes('concert') || cat.includes('musique') || cat.includes('jazz'))
    return 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800';
  if (cat.includes('nature') || cat.includes('randon') || cat.includes('aventure'))
    return 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800';
  if (cat.includes('mer') || cat.includes('plong') || cat.includes('nautique') || cat.includes('yoga') || cat.includes('détente'))
    return 'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800';
  if (cat.includes('artisan') || cat.includes('tradition') || cat.includes('poterie'))
    return 'https://images.unsplash.com/photo-1565193566173-7a0ee3dbe261?w=800';
  if (cat.includes('sport') || cat.includes('marathon'))
    return 'https://images.unsplash.com/photo-1452626038306-9aae5e071dd3?w=800';
  if (cat.includes('livre') || cat.includes('salon'))
    return 'https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=800';

  return type === 'ACTIVITY'
    ? 'https://images.unsplash.com/photo-1551632811-561732d1e306?w=800'
    : 'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=800';
}

export function isAlmostFull(availableSeats: number, capacity: number): boolean {
  return availableSeats > 0 && availableSeats <= Math.ceil(capacity * 0.15);
}

export function formatDateFr(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
    year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}