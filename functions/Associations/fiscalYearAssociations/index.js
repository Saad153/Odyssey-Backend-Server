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
// Rules:
// 1. On CREATE: never blocked by date, and never date-matched against other
//    fiscal year rows - the record is simply tagged with whichever fiscal
//    year is currently ACTIVE, exactly like the numbering suffix (see
//    getActiveFiscalYearSuffix). This is deliberate: matching by the
//    record's own date (e.g. an empty jobDate/tranDate falling back to
//    "now") could land a brand-new record in an unrelated, already-closed
//    fiscal year purely because today's real date happens to overlap it,
//    instantly locking something the user just created. Tagging is always
//    "whatever period you're actively working in", so backdating the
//    record's own date field is purely cosmetic and never blocks or
//    re-categorizes it. If no fiscal year is active, the record is left
//    untagged (still not blocked here - see getActiveFiscalYearSuffix for
//    where "no active fiscal year" actually stops a route).
// 2. On UPDATE/DESTROY: blocked outright if the record currently belongs to
//    a fiscal year that isn't active - a closed period is frozen, including
//    routine operational updates (e.g. recording a payment against an old
//    invoice), not just direct edits.

const getFiscalYearTagGate = () => async (instance, options) => {
    if (options.fiscalYearCheck === false) return;
    const activeFiscalYear = await FiscalYears.findOne({
        where: { isActive: true },
        transaction: options.transaction,
    });
    if (activeFiscalYear) {
        instance.FiscalYearId = activeFiscalYear.id;
    }
};

const getFiscalYearTagBulkGate = () => async (instances, options) => {
    if (options.fiscalYearCheck === false) return;
    const activeFiscalYear = await FiscalYears.findOne({
        where: { isActive: true },
        transaction: options.transaction,
    });
    if (!activeFiscalYear) return;
    instances.forEach((instance) => {
        instance.FiscalYearId = activeFiscalYear.id;
    });
};

// Throws if any FiscalYearId in the given list points to a closed fiscal year.
const assertNoneClosed = async (fiscalYearIds, transaction) => {
    const ids = [...new Set(fiscalYearIds)].filter(Boolean);
    if (!ids.length) return;
    const closedFiscalYear = await FiscalYears.findOne({
        where: { id: { [Op.in]: ids }, isActive: false },
        transaction,
    });
    if (closedFiscalYear) {
        throw new Error(
            `This record belongs to a closed fiscal year (${closedFiscalYear.label}) and cannot be modified. Reactivate that fiscal year first if this change is truly needed.`
        );
    }
};

// Instance-level path: instance.update() / instance.save() / instance.destroy()
const getFiscalYearLockGate = () => async (instance, options) => {
    if (options.fiscalYearCheck === false) return;
    await assertNoneClosed([instance.FiscalYearId], options.transaction);
};

// Static bulk path: Model.update(values, { where }) / Model.destroy({ where })
const getFiscalYearLockBulkGate = (Model) => async (options) => {
    if (options.fiscalYearCheck === false) return;
    const records = await Model.findAll({
        where: options.where,
        attributes: ['FiscalYearId'],
        transaction: options.transaction,
    });
    await assertNoneClosed(records.map((r) => r.FiscalYearId), options.transaction);
};

[Vouchers, SE_Job, Invoice].forEach((Model) => {
    Model.addHook('beforeCreate', getFiscalYearTagGate());
    Model.addHook('beforeBulkCreate', getFiscalYearTagBulkGate());

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
        await assertNoneClosed([record.FiscalYearId], options.transaction);
    }
});

// Replaces the ad hoc `moment().month()>=6 ? ... : ...` July-rollover math
// duplicated across job/voucher/invoice numbering with a lookup of the
// active fiscal year's own suffix, so numbering always reflects whichever
// fiscal year is currently open, regardless of what date is being entered.
const getActiveFiscalYearSuffix = async () => {
    const activeFiscalYear = await FiscalYears.findOne({ where: { isActive: true } });
    if (!activeFiscalYear) {
        throw new Error("No active fiscal year is open. Ask a CEO/CFO to open one before creating this record.");
    }
    return activeFiscalYear.suffix;
};

module.exports = { FiscalYears, getActiveFiscalYearSuffix };
