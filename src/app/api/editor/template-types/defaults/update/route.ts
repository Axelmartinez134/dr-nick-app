import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  // Global template-type defaults are treated as a baseline template and should not be modified
  // from the app UI. Per-user customization is stored in `carousel_template_type_overrides`.
  return NextResponse.json(
    { success: false, error: 'Global defaults are read-only. Use per-user overrides instead.' },
    { status: 403 }
  );
}


