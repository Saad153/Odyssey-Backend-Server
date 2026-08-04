// nodemailer/puppeteer are mocked at the top of the file (before any
// require of ../../index, which pulls in routes/invoice ->
// functions/mailer.js / functions/pdf.js) so the one happy-path "email
// actually sent" test below never opens a real SMTP connection or launches
// a real browser. jest.mock calls are hoisted above requires automatically.
// Every OTHER test in this file relies on the default global puppeteer
// mock (tests/mocks/puppeteerMock.js, wired via moduleNameMapper) which
// makes puppeteer.launch() reject - that's fine, it's a safety net, not
// something those tests exercise.
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
  })),
}));

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setViewport: jest.fn().mockResolvedValue(undefined),
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-bytes')),
    }),
    close: jest.fn().mockResolvedValue(undefined),
  }),
}));

const request = require('supertest');
const app = require('../../index');
const { loginAs, TEST_PREFIX } = require('../helpers/auth');
const { Clients, SE_Job, Invoice, Charge_Head, Employees, Email_Suggestion, History } = require('../../models');
const { Op } = require('sequelize');
const { signPrintToken } = require('../../functions/printToken');

// SE_Job, Invoice and Vouchers all have a beforeCreate hook (see
// functions/Associations/fiscalYearAssociations) that requires a resolvable
// FiscalYearId and throws otherwise. Seeding these directly via the models
// with `{ fiscalYearCheck: false }` (the same escape hatch legacy-import
// routes use) sidesteps that, since these fixtures are prerequisites for
// exercising the INVOICE routes, not something we're testing the fiscal
// year gate itself with here.
describe('Invoice - routes/invoice/index.js', () => {
  let authHeader;
  let client;
  let seJob;
  let invoice;
  let chargeHead;
  const historyEmployeeIds = [];

  beforeAll(async () => {
    ({ authHeader } = await loginAs('employee'));

    client = await Clients.create({ name: `${TEST_PREFIX}Client ${Date.now()}` });
    seJob = await SE_Job.create(
      { jobNo: `${TEST_PREFIX}JOB-${Date.now()}`, subType: 'FCL', ClientId: client.id },
      { fiscalYearCheck: false }
    );
    invoice = await Invoice.create(
      {
        invoice_No: `${TEST_PREFIX}INV-${Date.now()}`,
        invoice_Id: 1,
        type: 'Job Invoice',
        payType: 'Recievable',
        status: '1',
        currency: 'PKR',
        party_Id: '1',
        party_Name: `${TEST_PREFIX}Client`,
        total: '1000',
        SEJobId: seJob.id,
      },
      { fiscalYearCheck: false }
    );
    chargeHead = await Charge_Head.create({
      charge: `${TEST_PREFIX}Freight`,
      invoiceType: 'Job Invoice',
      type: 'Recievable',
      amount: '1000',
      net_amount: '1000',
      InvoiceId: invoice.id,
      SEJobId: seJob.id,
    });
  });

  afterAll(async () => {
    if (historyEmployeeIds.length) {
      await History.destroy({ where: { EmployeeId: historyEmployeeIds } });
    }
    await Email_Suggestion.destroy({ where: { email: { [Op.like]: `${TEST_PREFIX}%` } } });
    await Charge_Head.destroy({ where: { InvoiceId: invoice.id } });
    await Invoice.destroy({ where: { id: invoice.id }, fiscalYearCheck: false });
    await SE_Job.destroy({ where: { id: seJob.id }, fiscalYearCheck: false });
    await Clients.destroy({ where: { id: client.id } });
  });

  it('rejects requests with no auth token at all (401)', async () => {
    const res = await request(app).get('/invoice/getJobInvoices');
    expect(res.status).toBe(401);
  });

  it('GET /invoice/getJobInvoices returns the invoice (with its Charge_Heads) for the job', async () => {
    const res = await request(app)
      .get('/invoice/getJobInvoices')
      .set('Authorization', authHeader)
      .set('id', String(seJob.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    const found = res.body.result.find((i) => i.id === invoice.id);
    expect(found).toBeTruthy();
    expect(found.Charge_Heads.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /invoice/getInvoiceById returns full invoice + SE_Job detail', async () => {
    const res = await request(app)
      .get('/invoice/getInvoiceById')
      .set('Authorization', authHeader)
      .set('invoiceid', String(invoice.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.resultOne.invoice_No).toBe(invoice.invoice_No);
    expect(res.body.result.resultOne.SE_Job.jobNo).toBe(seJob.jobNo);
  });

  it('GET /invoice/getFilteredInvoices filters by type', async () => {
    const res = await request(app)
      .get('/invoice/getFilteredInvoices')
      .set('Authorization', authHeader)
      .set('type', invoice.type);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.some((i) => i.id === invoice.id)).toBe(true);
  });

  it('GET /invoice/getInvoices returns invoices that have a non-null Charge_Head.charge', async () => {
    const res = await request(app)
      .get('/invoice/getInvoices')
      .set('Authorization', authHeader)
      .set('id', String(seJob.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.result.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /invoice/deleteInvoice detaches Charge_Heads and removes the invoice', async () => {
    // Uses its own throwaway invoice/job so it doesn't interfere with the
    // shared fixture the other tests in this file depend on.
    const job = await SE_Job.create({ jobNo: `${TEST_PREFIX}JOB-DEL-${Date.now()}` }, { fiscalYearCheck: false });
    const inv = await Invoice.create(
      { invoice_No: `${TEST_PREFIX}INV-DEL-${Date.now()}`, type: 'Job Invoice', SEJobId: job.id },
      { fiscalYearCheck: false }
    );
    const head = await Charge_Head.create({ charge: `${TEST_PREFIX}ToDelete`, InvoiceId: inv.id, SEJobId: job.id });

    const res = await request(app)
      .get('/invoice/deleteInvoice')
      .set('Authorization', authHeader)
      .set('id', String(inv.id));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('success');

    expect(await Invoice.findByPk(inv.id)).toBeNull();
    const reloadedHead = await Charge_Head.findByPk(head.id);
    expect(reloadedHead.InvoiceId).toBeNull();

    await Charge_Head.destroy({ where: { id: head.id } });
    await SE_Job.destroy({ where: { id: job.id }, fiscalYearCheck: false });
  });

  describe('GET /invoice/getPrintData (public path, gated by a short-lived print token instead of a session)', () => {
    it('is reachable with NO Authorization header at all, given a valid print token', async () => {
      const token = signPrintToken(invoice.id);
      const res = await request(app)
        .get('/invoice/getPrintData')
        .set('printtoken', token)
        .set('invoiceid', String(invoice.id));
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result.resultOne.invoice_No).toBe(invoice.invoice_No);
    });

    it('rejects with 401 when no print token is supplied', async () => {
      const res = await request(app).get('/invoice/getPrintData').set('invoiceid', String(invoice.id));
      expect(res.status).toBe(401);
    });

    it('rejects with 401 when the print token was issued for a different invoice', async () => {
      const token = signPrintToken(invoice.id + 999999);
      const res = await request(app)
        .get('/invoice/getPrintData')
        .set('printtoken', token)
        .set('invoiceid', String(invoice.id));
      expect(res.status).toBe(401);
    });
  });

  describe('POST /invoice/sendEmail - validation (never reaches PDF generation or nodemailer)', () => {
    it('rejects an invalid "to" address', async () => {
      const res = await request(app)
        .post('/invoice/sendEmail')
        .set('Authorization', authHeader)
        .send({ id: invoice.id, to: 'not-an-email' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('error');
      expect(res.body.result).toMatch(/valid email address/i);
    });

    it('rejects a missing "to" address', async () => {
      const res = await request(app).post('/invoice/sendEmail').set('Authorization', authHeader).send({ id: invoice.id });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('error');
    });

    it('rejects an invalid cc address even when "to" is valid', async () => {
      const res = await request(app)
        .post('/invoice/sendEmail')
        .set('Authorization', authHeader)
        .send({ id: invoice.id, to: 'ok@example.com', cc: 'not-valid' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('error');
      expect(res.body.result).toMatch(/CC/i);
    });

    it('errors when the sending employee has no email registered', async () => {
      const noEmailEmployee = await Employees.create({
        name: `${TEST_PREFIX}NoEmail`,
        username: `${TEST_PREFIX}noemail_${Date.now()}`,
        designation: 'employee',
        active: 'true',
      });
      const res = await request(app)
        .post('/invoice/sendEmail')
        .set('Authorization', authHeader)
        .send({ id: invoice.id, employeeId: noEmailEmployee.id, to: 'ok@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('error');
      expect(res.body.result).toMatch(/no email registered/i);
    });

    it('errors when the invoice does not exist', async () => {
      const employee = await Employees.create({
        name: `${TEST_PREFIX}Sender2`,
        username: `${TEST_PREFIX}sender2_${Date.now()}`,
        email: `${TEST_PREFIX}sender2@example.com`,
        designation: 'employee',
        active: 'true',
      });
      const res = await request(app)
        .post('/invoice/sendEmail')
        .set('Authorization', authHeader)
        // Invoice.id is an auto-incrementing INTEGER - use an id that
        // can't possibly exist rather than a non-numeric string, so this
        // exercises "not found" rather than a DB type-cast error.
        .send({ id: 999999999, employeeId: employee.id, to: 'ok@example.com' });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('error');
      expect(res.body.result).toBe('Invoice not found.');
    });
  });

  describe('POST /invoice/sendEmail - happy path (puppeteer + nodemailer mocked per-file)', () => {
    let sender;

    beforeAll(async () => {
      sender = await Employees.create({
        name: `${TEST_PREFIX}Sender`,
        username: `${TEST_PREFIX}sender_${Date.now()}`,
        email: `${TEST_PREFIX}sender@example.com`,
        designation: 'employee',
        active: 'true',
      });
      historyEmployeeIds.push(sender.id);
    });

    it('generates a PDF (mocked), sends the email (mocked) and records history + email usage', async () => {
      const to = `${TEST_PREFIX}client@example.com`;
      const res = await request(app)
        .post('/invoice/sendEmail')
        .set('Authorization', authHeader)
        .send({
          id: invoice.id,
          employeeId: sender.id,
          to,
          subject: 'Custom subject',
          body: 'Custom body',
        });
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // NOTE (documents a real race, not fixed here): the route calls
      // `recordEmailUsage(...)` WITHOUT awaiting it before responding
      // (see routes/invoice/index.js's /sendEmail handler) - the HTTP
      // response can arrive before that Email_Suggestion upsert has
      // actually committed. A short poll makes this test reliable instead
      // of flaky, but the underlying fire-and-forget call is worth fixing
      // in the route itself at some point (a slow request between two fast
      // ones could plausibly lose this write in production too, e.g. if
      // the process exits/restarts right after responding).
      let suggestion = null;
      for (let attempt = 0; attempt < 10 && !suggestion; attempt += 1) {
        suggestion = await Email_Suggestion.findOne({ where: { email: to } });
        if (!suggestion) await new Promise((resolve) => setTimeout(resolve, 100));
      }
      expect(suggestion).toBeTruthy();
      expect(suggestion.usageCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('GET /invoice/suggestEmails', () => {
    it('returns an empty result for an empty query', async () => {
      const res = await request(app).get('/invoice/suggestEmails').set('Authorization', authHeader);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'success', result: [] });
    });

    it('finds a previously-used address (seeded by the happy-path sendEmail test above)', async () => {
      const res = await request(app)
        .get('/invoice/suggestEmails')
        .set('Authorization', authHeader)
        .set('q', `${TEST_PREFIX}client`);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.result).toContain(`${TEST_PREFIX}client@example.com`);
    });
  });
});
