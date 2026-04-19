/**
 * Configuration Stripe côté frontend
 * À adapter avec vos clés Stripe réelles
 *
 * ⚠️ IMPORTANT: pk_test_ est la clé PUBLIQUE, elle peut être exposée
 * Remplacez par votre vraie clé depuis https://dashboard.stripe.com
 */
export const STRIPE_CONFIG = {
  // Clé publique Stripe (pk_test_...)
  // Cette clé est exposée publiquement, donc pk_test_ est OK
  publicKey: 'pk_test_YOUR_PUBLISHABLE_KEY_HERE',

  // Environnement
  environment: 'test',
};

/**
 * Configuration visuelle des éléments Stripe
 */
export const STRIPE_ELEMENTS_CONFIG = {
  locale: 'fr', // Français
  appearance: {
    theme: 'stripe',
    variables: {
      colorPrimary: '#2563eb', // Bleu
      colorDanger: '#dc2626', // Rouge
      borderRadius: '6px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      spacingUnit: '4px',
    },
    rules: {
      '.Label': {
        fontSize: '14px',
        fontWeight: '500',
      },
      '.Input': {
        padding: '12px',
        border: '1px solid #e5e7eb',
      },
      '.Input:focus': {
        borderColor: '#2563eb',
        boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.1)',
      },
    },
  },
};
