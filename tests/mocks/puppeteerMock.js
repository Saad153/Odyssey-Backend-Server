// puppeteer ships an ESM-only entry point that Jest's default CJS transform
// can't parse, and integration tests here don't exercise real PDF rendering
// (functions/pdf.js's renderInvoicePdf is covered separately with this
// mocked) - stub it out so simply requiring index.js/routes/invoice doesn't
// blow up the whole test file.
module.exports = {
  launch: jest.fn().mockRejectedValue(
    new Error('puppeteer is mocked out in tests - renderInvoicePdf should be tested via functions/pdf.js unit tests with this mock, not by actually launching a browser.')
  ),
};
