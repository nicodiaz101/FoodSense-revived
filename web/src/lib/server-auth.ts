import { createRemoteJWKSet, jwtVerify, decodeJwt } from "jose";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"
);

// JWKS remoto cacheado automáticamente por jose
const JWKS = createRemoteJWKSet(FIREBASE_JWKS_URL);

export interface VerifiedFirebaseUser {
  uid: string;
  email?: string;
}

/**
 * Valida un Firebase ID Token emitido para nuestro proyecto.
 * No requiere service account privada; usa las claves públicas oficiales de Google.
 */
export async function verifyFirebaseIdToken(
  token: string
): Promise<VerifiedFirebaseUser | null> {
  const configuredProjectId = (
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "foodsense-revive"
  ).trim();

  try {
    const cleanToken = token.trim();
    const { payload } = await jwtVerify(cleanToken, JWKS, {
      issuer: `https://securetoken.google.com/${configuredProjectId}`,
      audience: configuredProjectId,
    });

    if (!payload.sub) {
      return null;
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (err) {
    console.error("[verifyFirebaseIdToken] Error validando token:", err);
    try {
      const decoded = decodeJwt(token);
      console.warn("[verifyFirebaseIdToken] Claims recibidos:", {
        iss: decoded.iss,
        aud: decoded.aud,
        sub: decoded.sub,
        configuredProjectId,
      });
    } catch {}
    return null;
  }
}
