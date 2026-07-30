const puppeteer = require('puppeteer');
const { signPrintToken } = require('./printToken');

// Renders the invoice by loading the frontend's bare print page in a headless
// browser (same InvoicePrint component the "Print" button uses), so the PDF
// always matches what a manual print would produce instead of drifting out
// of sync with a separately maintained backend template.
async function renderInvoicePdf(invoiceId) {
  const baseUrl = process.env.FRONTEND_BASE_URL;
  if (!baseUrl) {
    throw new Error('FRONTEND_BASE_URL is not configured.');
  }

  const token = signPrintToken(invoiceId);
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    // Puppeteer's default viewport (800x600) is narrower than a normal desktop
    // browser window, which reflows the Bootstrap grid taller than intended and
    // pushes the content just past one A4 page, producing a trailing blank page.
    await page.setViewport({ width: 1200, height: 1600 });
    await page.goto(`${baseUrl}/invoice-print/${invoiceId}?token=${token}`, {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    await page.waitForSelector('.invoice-print-root', { timeout: 10000 });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}

module.exports = { renderInvoicePdf };
