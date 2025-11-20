const { DataTypes } = require('sequelize')
const { Invoice, Charge_Head, Vouchers, Invoice_Losses, Invoice_Transactions } = require("../../../models");
//const { SE_Job, SE_Equipments } = require("../../functions/Associations/jobAssociations/seaExport");
const { SE_Job } = require("../jobAssociations/seaExport")

Invoice.hasMany(Charge_Head, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:true
    }
});
Charge_Head.belongsTo(Invoice);

Invoice.hasMany(Invoice_Losses, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:true
    }
});
Invoice_Losses.belongsTo(Invoice);

Invoice.hasMany(Invoice_Transactions, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Invoice_Transactions.belongsTo(Invoice);

Vouchers.hasMany(Invoice_Transactions, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Invoice_Transactions.belongsTo(Vouchers);

SE_Job.hasMany(Invoice, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:true
    }
});
Invoice.belongsTo(SE_Job);

SE_Job.hasMany(Charge_Head, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Charge_Head.belongsTo(SE_Job);

module.exports = { Charge_Head, Invoice, Vouchers, Invoice_Losses, Invoice_Transactions }