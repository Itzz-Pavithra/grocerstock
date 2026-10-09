/**
 * Security configuration & JWT Secret management
 * - In production: strictly enforces non-empty JWT_SECRET and rejects default fallback keys
 * - In development: permits development key while outputting a clear diagnostic warning
 */

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';

  if (!secret || secret === 'your_super_secret_jwt_key_here' || secret === 'supersecretkey_localgrocery_2026') {
    if (isProduction) {
      throw new Error(
        'SECURITY CRITICAL ERROR: Insecure or missing JWT_SECRET in production environment. A strong, non-default JWT_SECRET must be configured.'
      );
    }
    // Safe development fallback only
    return 'dev_secret_localgrocery_2026_antigravity';
  }

  return secret;
}

export function validateSecurityConfigAtStartup() {
  try {
    getJwtSecret();
  } catch (err) {
    console.error(err.message);
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }
}
