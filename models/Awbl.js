module.exports = (sequelize, DataTypes) => {
    const Awbl = sequelize.define("Awbl", {
        // First three digits of the AWB - the airline's IATA prefix (e.g. "125").
        // Held here as well as on the linked airline so a number stays readable
        // even if the party record is later renamed.
        prefix: {
            type: DataTypes.STRING(3),
            allowNull: false,
        },
        // The 7-digit running serial, zero padded and stored as text so a
        // leading zero can never be lost to numeric conversion.
        serial: {
            type: DataTypes.STRING(7),
            allowNull: false,
        },
        // IATA check digit = serial % 7, so always 0-6. See functions/awbl.js.
        checkDigit: {
            type: DataTypes.STRING(1),
            allowNull: false,
        },
        // prefix + serial + checkDigit. Denormalised so that searching and the
        // uniqueness rule are both a single indexed column rather than a
        // three-way composite.
        awbNumber: {
            type: DataTypes.STRING(11),
            allowNull: false,
        },
        // No companyId. AWB stock belongs to the group: airlines allocate
        // numbers to Sea Net / Air Cargo jointly and either company can use any
        // of them. Which company actually consumed a number is answered by the
        // job it is linked to (SEJobId -> SE_Job.companyId), so recording it
        // here as well would only be a second copy that could disagree.
        // unused -> free to pick on a job. used -> consumed by exactly one job
        // (SEJobId below). Nothing sets 'void' yet; the value is allowed so
        // numbers can later be written off without deleting the audit row.
        status: {
            type: DataTypes.STRING,
            defaultValue: "unused",
        },
        usedAt: {
            type: DataTypes.STRING,
        },
        createdById: {
            type: DataTypes.STRING,
        },
        remarks: {
            type: DataTypes.STRING,
        },
    }, {
        indexes: [
            // An air waybill number is unique worldwide - the airline prefix
            // plus serial identifies one shipment globally - so it exists in
            // the register exactly once. There is no company dimension: stock
            // belongs to the group, not to Sea Net or Air Cargo individually.
            //
            // This is also what makes the "one AWB cannot be used on two jobs"
            // rule safe under concurrency - see the conditional update in
            // routes/awbl.
            //
            // Beware when changing a unique index here: sync({alter:true}) will
            // try to create it against live data, and if any duplicate exists
            // the sync throws. Sync stops at the first failure, and Awbl is only
            // the fourth model loaded, so everything after it silently stops
            // syncing too. Clear the data first, then declare it.
            { name: "awbls_awb_number_unique", unique: true, fields: ["awbNumber"] },
            { fields: ["status"] },
        ]
    })
    return Awbl;
}
