const { Op } = require('sequelize');

/**
 * The next voucher number for a company + voucher type WITHIN a fiscal year.
 *
 * Voucher numbering restarts at 1 each fiscal year. The historical Climax data
 * does exactly that (SNS BPV ran 1..1373 in FY23, 1..1335 in FY24, 1..1875 in
 * FY26), and invoice numbering in routes/invoice already scopes itself the same
 * way. The voucher lookups did not scope by year at all, so every voucher
 * created in Odyssey carried on from the previous year's maximum - FY27 opened
 * at 1876 instead of restarting.
 *
 * Scoped on the "/<suffix>" that every voucher_Id ends with, rather than on
 * FiscalYearId, because rows imported from Climax have a null FiscalYearId.
 * Filtering on that column would skip them and hand back a number already in
 * use by an imported voucher.
 *
 * @param Vouchers  the Vouchers model
 * @param vType     voucher type (BPV, BRV, SI, PI, ...)
 * @param CompanyId scope to one company; omit only where numbering is
 *                  deliberately shared, which is nowhere today
 * @param suffix    fiscal year suffix, e.g. "27"
 */
const nextVoucherNo = async (Vouchers, { vType, CompanyId, suffix, transaction }) => {
  const last = await Vouchers.findOne({
    where: {
      vType,
      ...(CompanyId === undefined || CompanyId === null ? {} : { CompanyId }),
      voucher_Id: { [Op.like]: `%/${suffix}` },
    },
    attributes: ['voucher_No'],
    order: [['voucher_No', 'DESC']],
    transaction,
  });
  return last ? parseInt(last.voucher_No, 10) + 1 : 1;
};

module.exports = { nextVoucherNo };
