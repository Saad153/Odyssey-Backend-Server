const { DataTypes, Op } = require('sequelize')
const { FiscalYears } = require("../../../models");
const { Vouchers } = require("../voucherAssociations");
const { SE_Job } = require("../jobAssociations/seaExport");
const { Invoice } = require("../incoiceAssociations");

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
//    against an old invoice), not just direct edits.

const resolveSelectedFiscalYear = async (fiscalYearId, transaction) => {
    if (!fiscalYearId) {
        throw new Error("Select a fiscal year to work in before creating this record.");
    }
    const fiscalYear = await FiscalYears.findByPk(fiscalYearId, { transaction });
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

// Throws if any FiscalYearId in the given list points to a locked fiscal year.
const assertNoneLocked = async (fiscalYearIds, transaction) => {
    const ids = [...new Set(fiscalYearIds)].filter(Boolean);
    if (!ids.length) return;
    const lockedFiscalYear = await FiscalYears.findOne({
        where: { id: { [Op.in]: ids }, isLocked: true },
        transaction,
    });
    if (lockedFiscalYear) {
        throw new Error(
            `This record belongs to a locked fiscal year (${lockedFiscalYear.label}) and cannot be modified. Unlock that fiscal year first if this change is truly needed.`
        );
    }
};

// Instance-level path: instance.update() / instance.save() / instance.destroy()
const getFiscalYearLockGate = () => async (instance, options) => {
    if (options.fiscalYearCheck === false) return;
    await assertNoneLocked([instance.FiscalYearId], options.transaction);
};

// Static bulk path: Model.update(values, { where }) / Model.destroy({ where })
const getFiscalYearLockBulkGate = (Model) => async (options) => {
    if (options.fiscalYearCheck === false) return;
    const records = await Model.findAll({
        where: options.where,
        attributes: ['FiscalYearId'],
        transaction: options.transaction,
    });
    await assertNoneLocked(records.map((r) => r.FiscalYearId), options.transaction);
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
        await assertNoneLocked([record.FiscalYearId], options.transaction);
    }
});

module.exports = { FiscalYears, resolveSelectedFiscalYear };
