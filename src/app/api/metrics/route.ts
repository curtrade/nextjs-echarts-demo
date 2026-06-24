import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { parseMetrics } from '@/lib/metrics/parse';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'data', 'metrics.json');
    const raw = JSON.parse(await readFile(filePath, 'utf-8'));
    const dataset = parseMetrics(raw);
    return NextResponse.json(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
