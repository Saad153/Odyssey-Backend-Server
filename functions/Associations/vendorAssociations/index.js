const { DataTypes } = require('sequelize')
const { Vendors, Company, Vendor_Associations } = require("../../../models");
const { Employees } = require("../employeeAssociations");
const { Parent_Account, Child_Account } = require("../accountAssociations");

Vendors.belongsTo(Employees, { as: 'account_representator' });
// Vendors.belongsTo(Employees, { as: 'sales_representator' });
// Vendors.belongsTo(Employees, { as: 'doc_representator' });
Vendors.belongsTo(Employees, { as: 'authorizedBy' });

Vendors.hasMany(Vendor_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Vendor_Associations.belongsTo(Vendors)

Company.hasMany(Vendor_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Vendor_Associations.belongsTo(Company);

Parent_Account.hasMany(Vendor_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Vendor_Associations.belongsTo(Parent_Account);

Child_Account.hasMany(Vendor_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Vendor_Associations.belongsTo(Child_Account);

module.exports = { Vendors, Vendor_Associations }