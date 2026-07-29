const { DataTypes, Op } = require('sequelize')
const { FiscalYears } = require("../../../models");
const { Vouchers } = require("../voucherAssociations");
const { SE_Job } = require("../jobAssociations/seaExport");
const { Invoice } = require("../incoiceAssociations");
const { getSelectedFiscalYearId } = require("../../fiscalYearContext");

FiscalYears.hasMany(Vouchers, {
    foreignKey: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});
Vouchers.belongsTo(FiscalYears);

FiscalYears.hasMany(SE_Job, {
    foreignKey: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});
SE_Job.belongsTo(FiscalYears);

FiscalYears.hasMany(Invoice, {
    foreignKey: {
        type: DataTypes.INTEGER,
        allowNull: true
    }
});
Invoice.belongsTo(FiscalYears);

// These hooks live on the models (rather than being repeated in every route)
// for the same reason the Voucher_Heads amount-sign normalization does: one
// choke point that every create/update/destroy call across every route goes
// through automatically. Legacy-data-import routes pass
// `{ fiscalYearCheck: false }` in the call options to bypass all of this.
//
// Model: every user picks which fiscal year they're working in (a session
// selection made in the frontend, sent as `fiscalYearId` on each create
// request) - there is no more single "active" fiscal year. CEO/CFO/admin
// can independently LOCK any fiscal year, which does two things:
// 1. On CREATE: the route resolves the user's selected fiscal year via
//    resolveSelectedFiscalYear() *before* building the record (this is
//    also where the numbering suffix comes from), and sets it on the
//    instance. These hooks are the backstop that rejects a create if that
//    didn't happen (no FiscalYearId set) or if it resolves to a locked
//    fiscal year - same validation, just redone here so nothing can create
//    a record against a locked year via a route that forgot the check.
// 2. On UPDATE/DESTROY: blocked outright if the record currently belongs
//    to a fiscal year that is locked - a locked period is frozen,
//    including routine operational updates (e.g. recording a payment
//    against an old invoice), not just direct edits. ALSO blocked if the
//    record belongs to a fiscal year other than the one the requesting
//    user currently has selected (even if that other year is unlocked) -
//    you can only work with records in your own selected year; to touch
//    a job/voucher/invoice from a different unlocked year, switch your
//    selection to that year first on the Fiscal Years page. The selected
//    year is read from the x-fiscal-year-id header via
//    functions/fiscalYearContext.js (attached to every request by the
//    frontend's axios interceptor), not passed through each route by hand.

const resolveSelectedFiscalYear = async (fiscalYearId, transaction) => {
    // Falls back to the request's x-fiscal-year-id header (via
    // fiscalYearContext) if the route didn't pass an explicit id - a
    // safety net so any route that forgets this still gets it right,
    // rather than silently creating an untagged record.
    const resolvedId = fiscalYearId || getSelectedFiscalYearId();
    if (!resolvedId) {
        throw new Error("Select a fiscal year to work in before creating this record.");
    }
    const fiscalYear = await FiscalYears.findByPk(resolvedId, { transaction });
    if (!fiscalYear) {
        throw new Error("Selected fiscal year not found.");
    }
    if (fiscalYear.isLocked) {
        throw new Error(`Fiscal year "${fiscalYear.label}" is locked and cannot be used for new records.`);
    }
    return fiscalYear;
};

const getFiscalYearCreateGate = () => async (instance, options) => {
    if (options.fiscalYearCheck === false) return;
    await resolveSelectedFiscalYear(instance.FiscalYearId, options.transaction);
};

const getFiscalYearCreateBulkGate = () => async (instances, options) => {
    if (options.fiscalYearCheck === false) return;
    // All rows in one bulkCreate call are expected to share the same
    // selected fiscal year - validate each since nothing stops them from
    // differing, but avoid re-querying the same id repeatedly.
    const checked = new Map();
    for (const instance of instances) {
        const id = instance.FiscalYearId;
        if (!checked.has(id)) {
            checked.set(id, resolveSelectedFiscalYear(id, options.transaction));
        }
        await checked.get(id);
    }
};

// Throws if any FiscalYearId in the given list points to a locked fiscal
// year, or (when the requesting user has a fiscal year selected) to one
// other than their current selection. Records with no FiscalYearId at all
// (e.g. legacy data predating this feature) are left alone - there's no
// fiscal year context to enforce against.
const assertWorkable = async (fiscalYearIds, transaction) => {
    const ids = [...new Set(fiscalYearIds)].filter(Boolean);
    if (!ids.length) return;

    const relevantFiscalYears = await FiscalYears.findAll({
        where: { id: { [Op.in]: ids } },
        transaction,
    });

    const lockedFiscalYear = relevantFiscalYears.find((fy) => fy.isLocked);
    if (lockedFiscalYear) {
        throw new Error(
            `This record belongs to a locked fiscal year (${lockedFiscalYear.label}) and cannot be modified. Unlock that fiscal year first if this change is truly needed.`
        );
    }

    const selectedFiscalYearId = getSelectedFiscalYearId();
    if (selectedFiscalYearId) {
        const mismatched = relevantFiscalYears.find((fy) => String(fy.id) !== String(selectedFiscalYearId));
        if (mismatched) {
            throw new Error(
                `This record belongs to fiscal year "${mismatched.label}", not your currently selected fiscal year. Switch your selected fiscal year on the Fiscal Years page to work with it.`
            );
        }
    }
};

// Instance-level path: instance.update() / instance.save() / instance.destroy()
const getFiscalYearLockGate = () => async (instance, options) => {
    if (options.fiscalYearCheck === false) return;
    await assertWorkable([instance.FiscalYearId], options.transaction);
};

// Static bulk path: Model.update(values, { where }) / Model.destroy({ where })
const getFiscalYearLockBulkGate = (Model) => async (options) => {
    if (options.fiscalYearCheck === false) return;
    const records = await Model.findAll({
        where: options.where,
        attributes: ['FiscalYearId'],
        transaction: options.transaction,
    });
    await assertWorkable(records.map((r) => r.FiscalYearId), options.transaction);
};

[Vouchers, SE_Job, Invoice].forEach((Model) => {
    Model.addHook('beforeCreate', getFiscalYearCreateGate());
    Model.addHook('beforeBulkCreate', getFiscalYearCreateBulkGate());

    Model.addHook('beforeUpdate', getFiscalYearLockGate());
    Model.addHook('beforeBulkUpdate', getFiscalYearLockBulkGate(Model));
    Model.addHook('beforeDestroy', getFiscalYearLockGate());
    Model.addHook('beforeBulkDestroy', getFiscalYearLockBulkGate(Model));
});

// Vouchers.upsert() is only ever used for edits in this codebase (always
// carries an existing id) - route it through the same lock check.
Vouchers.addHook('beforeUpsert', async (values, options) => {
    if (options.fiscalYearCheck === false || !values.id) return;
    const record = await Vouchers.findByPk(values.id, {
        attributes: ['FiscalYearId'],
        transaction: options.transaction,
    });
    if (record) {
        await assertWorkable([record.FiscalYearId], options.transaction);
    }
});

module.exports = { FiscalYears, resolveSelectedFiscalYear };
