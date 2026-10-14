import { createRemoteJWKSet, jwtVerify } from "jose";

const FIREBASE_JWKS_URL = new URL(
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com"
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
  const projectId =
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "foodsense-revive";

  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (!payload.sub) {
      return null;
    }

    return {
      uid: payload.sub,
      email: typeof payload.email === "string" ? payload.email : undefined,
    };
  } catch (err) {
    console.warn("[verifyFirebaseIdToken] Falló validación de token:", err);
    return null;
  }
}
