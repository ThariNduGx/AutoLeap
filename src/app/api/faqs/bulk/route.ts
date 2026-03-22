import { NextRequest, NextResponse } from 'next/server';
import { storeFAQ } from '@/lib/infrastructure/embeddings';
import { getSession, hasRole } from '@/lib/auth/session';
import { rateLimit } from '@/lib/infrastructure/rate-limit';

export const dynamic = 'force-dynamic';

// Process this many rows in parallel to avoid sequential embedding API calls
// timing out the Edge runtime (25s limit).
const BATCH_SIZE = 5;

/**
 * POST /api/faqs/bulk
 *
 * Upload a CSV file to bulk-import FAQs.
 * Expected CSV format (with header row):
 *   question,answer,category
 *
 * SECURITY: Business ID comes from session, NOT from request.
 */
export async function POST(req: NextRequest) {
  // 3 bulk imports per minute per IP — each import can be hundreds of rows
  const rl = await rateLimit(req, 'api/faqs/bulk', { limit: 3, windowSeconds: 60 });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  const session = await getSession(req);

  if (!session || !hasRole(session, 'business')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const businessId = session.businessId;
  if (!businessId) {
    return NextResponse.json({ error: 'No business associated with this account' }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.name.endsWith('.csv')) {
      return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 });
    }

    // Limit to 500KB to prevent abuse
    if (file.size > 512_000) {
      return NextResponse.json({ error: 'File too large (max 500 KB)' }, { status: 413 });
    }

    const text = await file.text();
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return NextResponse.json({ error: 'CSV must have a header row and at least one data row' }, { status: 400 });
    }

    // Parse header to find column indices (case-insensitive)
    const header = parseCSVRow(lines[0]).map(h => h.toLowerCase().trim());
    const qIdx = header.indexOf('question');
    const aIdx = header.indexOf('answer');
    const cIdx = header.indexOf('category');

    if (qIdx === -1 || aIdx === -1) {
      return NextResponse.json(
        { error: 'CSV must have "question" and "answer" columns' },
        { status: 400 }
      );
    }

    // Pre-validate all rows, collecting valid ones for processing
    type ValidRow = { lineNum: number; question: string; answer: string; category: string };
    let imported = 0;
    const errors: string[] = [];
    const validRows: ValidRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCSVRow(lines[i]);
      const question = cols[qIdx]?.trim();
      const answer = cols[aIdx]?.trim();
      const category = (cIdx !== -1 ? cols[cIdx]?.trim() : '') || 'general';

      if (!question || !answer) {
        errors.push(`Row ${i + 1}: missing question or answer — skipped`);
        continue;
      }
      validRows.push({ lineNum: i + 1, question, answer, category });
    }

    // Process in parallel batches to stay within Edge runtime timeout.
    // 5 concurrent embedding API calls × ~500ms ≈ 0.5s per batch.
    for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
      const batch = validRows.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(r => storeFAQ(businessId, r.question, r.answer, r.category))
      );
      results.forEach((ok, j) => {
        if (ok) {
          imported++;
        } else {
          errors.push(`Row ${batch[j].lineNum}: failed to store — skipped`);
        }
      });
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped: errors.length,
      errors: errors.slice(0, 10), // Return at most 10 error details
    });
  } catch (error) {
    console.error('[FAQ BULK] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * Parse a single CSV row, respecting quoted fields.
 */
function parseCSVRow(row: string): string[] {
  const cols: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const ch = row[i];
    if (ch === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cols.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  cols.push(current);
  return cols;
}
