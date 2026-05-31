// ─── ILU SHOP — API : Validation serveur des médias ─────────────────────────
// POST /api/admin/validate-media
// Valide le type et la taille d'un fichier image avant upload Firebase.
// Appelé par le product-form côté client avant tout upload.

import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
const MIN_DIMENSION = 400;               // px — recommandé pour les photos produit

interface ValidateRequest {
  type: string;
  size: number;
  width?: number;
  height?: number;
  filename?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ValidateRequest;
    const { type, size, width, height, filename } = body;

    if (!type || typeof size !== 'number') {
      return NextResponse.json(
        { error: 'Paramètres manquants (type, size).' },
        { status: 400 },
      );
    }

    // ── Vérification du type MIME ──────────────────────────────────────────
    if (!ALLOWED_TYPES.has(type.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Format non autorisé : ${type}. Formats acceptés : JPEG, PNG, WebP.`,
          code: 'INVALID_TYPE',
        },
        { status: 422 },
      );
    }

    // ── Vérification de la taille ──────────────────────────────────────────
    if (size > MAX_SIZE_BYTES) {
      const mb = (size / 1024 / 1024).toFixed(1);
      return NextResponse.json(
        {
          error: `Fichier trop lourd : ${mb} Mo. Maximum autorisé : 10 Mo.`,
          code: 'FILE_TOO_LARGE',
        },
        { status: 422 },
      );
    }

    // ── Avertissement dimensions (non bloquant) ────────────────────────────
    const warnings: string[] = [];
    if (width !== undefined && height !== undefined) {
      if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
        warnings.push(
          `Résolution faible : ${width}×${height}px. Recommandé : ${MIN_DIMENSION}px minimum pour une bonne qualité.`,
        );
      }
    }

    return NextResponse.json({
      ok: true,
      filename: filename ?? 'inconnu',
      type,
      sizeMb: (size / 1024 / 1024).toFixed(2),
      ...(warnings.length > 0 ? { warnings } : {}),
    });
  } catch {
    return NextResponse.json(
      { error: 'Erreur interne de validation.' },
      { status: 500 },
    );
  }
}
