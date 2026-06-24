import { NextResponse } from 'next/server';
import { parseMetrics } from '@/lib/metrics/parse';

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Файл не передан' }, { status: 400 });
    }
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      return NextResponse.json({ error: 'Невалидный JSON' }, { status: 400 });
    }
    const dataset = parseMetrics(raw);
    return NextResponse.json(dataset);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
