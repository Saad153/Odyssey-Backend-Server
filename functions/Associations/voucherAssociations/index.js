const { DataTypes } = require('sequelize')
const { Company, Invoice, Vouchers, Voucher_Heads, Office_Vouchers } = require("../../../models");
const { Child_Account } = require("../accountAssociations");
const { Employees } = require("../employeeAssociations")

//Vendors.belongsTo(Employees, { as: 'account_representator' });

Company.hasMany(Vouchers, {
    foreignKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Vouchers.belongsTo(Company);

Vouchers.hasMany(Voucher_Heads, {
    foreignKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Voucher_Heads.belongsTo(Vouchers);

Child_Account.hasMany(Voucher_Heads, {
    foreignKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Voucher_Heads.belongsTo(Child_Account);

Employees.hasMany(Office_Vouchers, {
    foreignKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Office_Vouchers.belongsTo(Employees);

Vouchers.hasMany(Office_Vouchers, {
    foreignKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Office_Vouchers.belongsTo(Vouchers);

Vouchers.hasMany(Invoice, {
    foreignKey:{
        type: DataTypes.INTEGER,
        allowNull:true,
        as: 'invoice_Id'
    }
});
Invoice.belongsTo(Vouchers);

module.exports = { Vouchers, Voucher_Heads, Office_Vouchers }