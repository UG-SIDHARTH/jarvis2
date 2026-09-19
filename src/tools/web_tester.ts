import type { ToolDefinition, ToolContext } from './types.ts';

export interface WebsiteTestResult {
  url: string;
  status: number;
  statusText: string;
  ok: boolean;
  responseTimeMs: number;
  protocol?: string;
  contentType?: string;
  title?: string;
  metaDescription?: string;
  headers: Record<string, string>;
  sslSecure: boolean;
}

export const testWebsiteTool: ToolDefinition = {
  name: 'test_website',
  description: 'Test a website URL for availability, response time, HTTP status, SSL security, and SEO metadata.',
  parameters: {
    type: 'OBJECT',
    properties: {
      url: {
        type: 'STRING',
        description: 'The full URL of the website to test (e.g. https://google.com).',
      },
      timeoutMs: {
        type: 'NUMBER',
        description: 'Optional timeout in milliseconds (defaults to 10000).',
      },
    },
    required: ['url'],
  },
  async execute(args: { url: string; timeoutMs?: number }, _ctx: ToolContext) {
    let targetUrl = args.url.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `https://${targetUrl}`;
    }

    const startTime = performance.now();
    const timeout = args.timeoutMs || 10000;

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      const res = await fetch(targetUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 JARVIS/2.0 WebAuditor',
        },
      });

      clearTimeout(timer);
      const responseTimeMs = Math.round(performance.now() - startTime);

      const html = await res.text();

      // Extract title and meta description
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const metaDescMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);

      const headersObj: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        headersObj[key] = val;
      });

      const result: WebsiteTestResult = {
        url: targetUrl,
        status: res.status,
        statusText: res.statusText,
        ok: res.ok,
        responseTimeMs,
        contentType: res.headers.get('content-type') || undefined,
        title: titleMatch ? titleMatch[1].trim() : undefined,
        metaDescription: metaDescMatch ? metaDescMatch[1].trim() : undefined,
        headers: headersObj,
        sslSecure: targetUrl.startsWith('https://'),
      };

      return {
        success: true,
        message: `Website "${targetUrl}" responded with HTTP ${res.status} (${responseTimeMs}ms).`,
        data: result,
      };
    } catch (err: any) {
      const responseTimeMs = Math.round(performance.now() - startTime);
      return {
        success: false,
        error: err.name === 'AbortError' ? `Request timed out after ${timeout}ms` : err.message,
        url: targetUrl,
        responseTimeMs,
      };
    }
  },
};
