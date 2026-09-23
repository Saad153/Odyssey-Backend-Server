/*
 * Shared definitions for replacing one party with another.
 *
 * A party id is referenced from two very different kinds of place, and the
 * distinction is what makes the feature safe:
 *
 *  OPERATIONAL references (jobs, BLs, AWB stock, associations) can simply be
 *  repointed at the replacement party. Nothing about the shipment changes.
 *
 *  FINANCIAL references (invoices, vouchers, transactions, charge heads) are
 *  accounting records. Moving them between parties silently rewrites who owes
 *  or is owed money, so their presence BLOCKS the replacement instead. They
 *  also carry a denormalised copy of the party NAME, which would then disagree
 *  with the id.
 *
 * Note that the financial columns are `character varying` and carry NO foreign
 * key - they are not visible in information_schema as references to Clients at
 * all. Anything that walked only the declared foreign keys would repoint the
 * jobs, delete the party, and leave every invoice and voucher pointing at an id
 * that no longer exists.
 */

// Repointed on merge. Integer columns with a real FK to Clients.
const OPERATIONAL_REFS = [
  { table: 'SE_Jobs', column: 'ClientId', label: 'Jobs (as client)' },
  { table: 'SE_Jobs', column: 'airLineId', label: 'Jobs (as airline)' },
  { table: 'SE_Jobs', column: 'consigneeId', label: 'Jobs (as consignee)' },
  { table: 'SE_Jobs', column: 'customAgentId', label: 'Jobs (as custom agent)' },
  { table: 'SE_Jobs', column: 'forwarderId', label: 'Jobs (as forwarder)' },
  { table: 'SE_Jobs', column: 'localVendorId', label: 'Jobs (as local vendor)' },
  { table: 'SE_Jobs', column: 'overseasAgentId', label: 'Jobs (as overseas agent)' },
  { table: 'SE_Jobs', column: 'shipperId', label: 'Jobs (as shipper)' },
  { table: 'SE_Jobs', column: 'shippingLineId', label: 'Jobs (as shipping line)' },
  { table: 'SE_Jobs', column: 'transporterId', label: 'Jobs (as transporter)' },
  { table: 'Bls', column: 'notifyPartyOneId', label: 'BLs (notify party 1)' },
  { table: 'Bls', column: 'notifyPartyTwoId', label: 'BLs (notify party 2)' },
  { table: 'Awbls', column: 'AirlineId', label: 'AWB numbers (airline)' },
  { table: 'Client_Associations', column: 'ClientId', label: 'Party ledger associations' },
];

// Block the merge. varchar columns holding the id as text, with no FK.
const FINANCIAL_REFS = [
  { table: 'Invoices', column: 'party_Id', label: 'Invoices / Bills' },
  { table: 'Vouchers', column: 'partyId', label: 'Vouchers' },
  { table: 'Transactions', column: 'partyId', label: 'Transactions' },
  { table: 'Charge_Heads', column: 'partyId', label: 'Job charge heads' },
];

// total/paid/recieved are STRING columns. NULLIF guards the empty strings, and
// every value in the table is numeric-safe (verified), so the cast is sound.
const num = (col) => `COALESCE(NULLIF(btrim("${col}"), ''), '0')::numeric`;

/*
 * Outstanding = total - GREATEST(paid, recieved), NOT total - (paid + recieved).
 *
 * The two columns are mirror copies: on all 32,656 settled invoices `paid` and
 * `recieved` hold the identical amount regardless of whether the invoice is
 * Payble or Recievable. Summing them therefore double-counts the settlement and
 * under-reports what is still owed by roughly 600 invoices.
 */
const OUTSTANDING_SQL = `${num('total')} - GREATEST(${num('paid')}, ${num('recieved')})`;

// Rounding tolerance. Settlements are written back rounded, so an invoice of
// 51767.43 settled at 51767 leaves 0.43 behind - dust, not a debt.
const PAID_TOLERANCE = 1;

module.exports = {
  OPERATIONAL_REFS,
  FINANCIAL_REFS,
  OUTSTANDING_SQL,
  PAID_TOLERANCE,
  num,
};
