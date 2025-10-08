module.exports = (sequelize, DataTypes) => {

    const Charge_Head = sequelize.define("Charge_Head", {
        charge:{ type:DataTypes.STRING },
        particular:{ type:DataTypes.STRING },
        invoice_id:{ type:DataTypes.STRING },
        description:{ type:DataTypes.STRING },
        name:{ type:DataTypes.STRING },
        partyId:{ type:DataTypes.STRING },
        invoiceType:{ type:DataTypes.STRING },
        type:{ type:DataTypes.STRING },
        basis:{ type:DataTypes.STRING },
        pp_cc:{ type:DataTypes.STRING },
        size_type:{ type:DataTypes.STRING },
        dg_type:{ type:DataTypes.STRING },
        qty:{ type:DataTypes.STRING },
        rate_charge:{ type:DataTypes.STRING },
        currency:{ type:DataTypes.STRING },
        amount:{ type:DataTypes.STRING },
        discount:{ type:DataTypes.STRING },
        taxPerc:{ type:DataTypes.STRING },
        tax_apply:{ type:DataTypes.BOOLEAN },
        tax_amount:{ type:DataTypes.STRING },
        net_amount:{ type:DataTypes.STRING },
        ex_rate:{ type:DataTypes.STRING },
        local_amount:{ type:DataTypes.STRING },
        status:{ type:DataTypes.STRING },
        approved_by:{ type:DataTypes.STRING },
        approval_date:{ type:DataTypes.STRING },
        partyType:{ type:DataTypes.STRING },
    }, {timestamps: false})
    return Charge_Head;
}