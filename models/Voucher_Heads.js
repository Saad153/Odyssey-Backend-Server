// A voucher head's amount is always a magnitude - direction (debit vs
// credit) is carried entirely by the `type` column. Several call sites
// across the codebase have historically passed a signed number in by
// mistake (e.g. a raw user-entered "-111620"), which breaks the trial
// balance since the two sides of the entry stop being equal-and-opposite
// positive numbers. These hooks are the single choke point that every
// create/bulkCreate/update/upsert of a Voucher_Heads row goes through, so
// normalizing here closes the door regardless of which route writes it.
const normalizeAmount = (value) => {
    if (value === null || value === undefined || value === "") return value;
    const parsed = parseFloat(value);
    if (isNaN(parsed)) return value;
    return String(Math.abs(parsed));
};

module.exports = (sequelize, DataTypes) => {
    const Voucher_Heads = sequelize.define("Voucher_Heads", {
        defaultAmount:{
            type:DataTypes.STRING
        },
        amount:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        type:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        narration:{
            type:DataTypes.TEXT
        },

        settlement:{
            type:DataTypes.STRING
        },
        accountType:{
            type:DataTypes.STRING
        },
        climaxId:{
            type:DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        hooks: {
            beforeCreate: (voucherHead) => {
                voucherHead.amount = normalizeAmount(voucherHead.amount);
                voucherHead.defaultAmount = normalizeAmount(voucherHead.defaultAmount);
            },
            beforeBulkCreate: (voucherHeads) => {
                voucherHeads.forEach((voucherHead) => {
                    voucherHead.amount = normalizeAmount(voucherHead.amount);
                    voucherHead.defaultAmount = normalizeAmount(voucherHead.defaultAmount);
                });
            },
            beforeUpdate: (voucherHead) => {
                if (voucherHead.changed('amount')) {
                    voucherHead.amount = normalizeAmount(voucherHead.amount);
                }
                if (voucherHead.changed('defaultAmount')) {
                    voucherHead.defaultAmount = normalizeAmount(voucherHead.defaultAmount);
                }
            },
            beforeBulkUpdate: (options) => {
                if (options.attributes) {
                    if ('amount' in options.attributes) {
                        options.attributes.amount = normalizeAmount(options.attributes.amount);
                    }
                    if ('defaultAmount' in options.attributes) {
                        options.attributes.defaultAmount = normalizeAmount(options.attributes.defaultAmount);
                    }
                }
            },
            beforeUpsert: (values) => {
                values.amount = normalizeAmount(values.amount);
                values.defaultAmount = normalizeAmount(values.defaultAmount);
            },
        },
    })
    return Voucher_Heads;
}