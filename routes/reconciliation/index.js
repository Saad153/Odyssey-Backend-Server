const { SE_Job, Invoice, Vouchers, Charge_Head } = require("../../models");
const routes = require('express').Router();

// Read-only bridge to the legacy Climax system (see Climax-Server-Backup,
// a separate service — GET /jobs/getReconciliationData there).
const CLIMAX_BRIDGE_URL = process.env.CLIMAX_BRIDGE_URL || 'http://localhost:8081';

// Compares Odyssey against the legacy Climax DB (via its read-only bridge
// service) to find records users haven't entered into Odyssey yet: jobs,
// invoices, and vouchers are matched 1:1 by climaxId. Charge_Heads have no
// legacy id at all, so they're compared by count-per-job instead (does the
// matched job have as many charge lines in Odyssey as it did in Climax).
routes.get("/check", async(req, res) => {
  try {
    let bridgeRes;
    try {
      bridgeRes = await fetch(`${CLIMAX_BRIDGE_URL}/jobs/getReconciliationData`);
    } catch (fetchError) {
      return res.json({ status:'error', result:`Could not reach the Climax bridge service at ${CLIMAX_BRIDGE_URL}. Is it running?` });
    }
    if (!bridgeRes.ok) {
      return res.json({ status:'error', result:`Climax bridge service responded with HTTP ${bridgeRes.status}.` });
    }
    const bridgeData = await bridgeRes.json();
    if (bridgeData.status !== 'success') {
      return res.json({ status:'error', result: bridgeData.result || 'Climax bridge service returned an error.' });
    }
    const { jobs: legacyJobs, invoices: legacyInvoices, vouchers: legacyVouchers } = bridgeData.result;

    const [odysseyJobs, odysseyInvoices, odysseyVouchers, odysseyChargeHeads] = await Promise.all([
      SE_Job.findAll({ attributes:['id', 'climaxId', 'operation', 'jobNo'] }),
      Invoice.findAll({ attributes:['id', 'climaxId', 'invoice_No'] }),
      Vouchers.findAll({ attributes:['id', 'climaxId', 'voucher_No'] }),
      Charge_Head.findAll({ attributes:['SEJobId'] }),
    ]);

    const jobClimaxIds = new Set(odysseyJobs.filter(j => j.climaxId != null).map(j => String(j.climaxId)));
    const invoiceClimaxIds = new Set(odysseyInvoices.filter(i => i.climaxId != null).map(i => String(i.climaxId)));
    const voucherClimaxIds = new Set(odysseyVouchers.filter(v => v.climaxId != null).map(v => String(v.climaxId)));

    const odysseyChargeCountByJobId = {};
    odysseyChargeHeads.forEach(c => {
      odysseyChargeCountByJobId[c.SEJobId] = (odysseyChargeCountByJobId[c.SEJobId] || 0) + 1;
    });
    const climaxIdToOdysseyChargeCount = {};
    odysseyJobs.forEach(j => {
      if (j.climaxId != null) {
        climaxIdToOdysseyChargeCount[String(j.climaxId)] = odysseyChargeCountByJobId[j.id] || 0;
      }
    });

    const missingJobs = legacyJobs.filter(j => !jobClimaxIds.has(String(j.id)));
    const incompleteCharges = legacyJobs
      .filter(j => jobClimaxIds.has(String(j.id)) && j.chargeCount > (climaxIdToOdysseyChargeCount[String(j.id)] || 0))
      .map(j => ({ ...j, odysseyChargeCount: climaxIdToOdysseyChargeCount[String(j.id)] || 0 }));

    const missingInvoices = legacyInvoices.filter(i => !invoiceClimaxIds.has(String(i.id)));
    const missingVouchers = legacyVouchers.filter(v => !voucherClimaxIds.has(String(v.id)));

    res.json({
      status:'success',
      result:{
        summary:{
          jobs:{ legacyTotal:legacyJobs.length, missing:missingJobs.length, incompleteCharges:incompleteCharges.length },
          invoices:{ legacyTotal:legacyInvoices.length, missing:missingInvoices.length },
          vouchers:{ legacyTotal:legacyVouchers.length, missing:missingVouchers.length },
        },
        missingJobs,
        incompleteCharges,
        missingInvoices,
        missingVouchers,
      }
    });
  }
  catch (error) {
    console.error(error);
    res.json({ status:'error', result: error.message || 'Failed to run reconciliation check.' });
  }
});

module.exports = routes;
