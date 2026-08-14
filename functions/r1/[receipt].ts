import { formatCompact, formatMesosShortPrecise, formatPercent, formatRatio } from '../../src/domain/format';
import { decodeRatioReceipt } from '../../src/domain/ratioReceipt';
import { calculateRatioReceipt } from '../../src/domain/ratioReceiptCalculation';

export type ReceiptPreviewMetadata = {
  title: string;
  description: string;
  url: string;
};

type PagesContext = {
  request: Request;
  params: { receipt: string };
  next(): Promise<Response>;
};

function escapeHtmlAttribute(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function createReceiptPreviewMetadata(payload: string, requestUrl: string): ReceiptPreviewMetadata | undefined {
  try {
    const receipt = decodeRatioReceipt(payload);
    const calculation = calculateRatioReceipt(receipt);
    const canonicalUrl = new URL(requestUrl);
    canonicalUrl.search = '';
    canonicalUrl.hash = '';
    const due = calculation.mesosDue === undefined ? undefined : formatMesosShortPrecise(calculation.mesosDue);
    const progress = `Lv.${receipt.startLevel} ${formatPercent(receipt.startExpPercent)} → Lv.${receipt.endLevel} ${formatPercent(receipt.endExpPercent)}`;
    const billing = `${formatRatio(receipt.ratio)} · ${formatCompact(calculation.expGained)} EXP`;

    return {
      title: due ? `${receipt.ign} · ${due} mesos due` : `${receipt.ign} · Ratio receipt`,
      description: `${progress} · ${billing}`,
      url: canonicalUrl.toString(),
    };
  } catch {
    return undefined;
  }
}

export function receiptOpenGraphTags(metadata: ReceiptPreviewMetadata) {
  const attributes = [
    ['og:type', 'website'],
    ['og:site_name', 'Holy Symbol'],
    ['og:title', metadata.title],
    ['og:description', metadata.description],
    ['og:url', metadata.url],
  ];
  return attributes
    .map(([property, content]) => `<meta property="${property}" content="${escapeHtmlAttribute(content)}">`)
    .join('');
}

export async function onRequestGet(context: PagesContext) {
  const metadata = createReceiptPreviewMetadata(context.params.receipt, context.request.url);
  const response = await context.next();
  if (!metadata || !response.headers.get('content-type')?.includes('text/html')) return response;

  return new HTMLRewriter()
    .on('head', {
      element(element) {
        element.append(receiptOpenGraphTags(metadata), { html: true });
      },
    })
    .transform(response);
}
