const { DataTypes } = require('sequelize')
const { Clients, Company, Client_Associations } = require("../../../models");
const { Employees } = require("../employeeAssociations");
const { Parent_Account, Child_Account } = require("../accountAssociations");

Clients.belongsTo(Employees, { as: 'account_representator' });
Clients.belongsTo(Employees, { as: 'sales_representator' });
Clients.belongsTo(Employees, { as: 'doc_representator' });
Clients.belongsTo(Employees, { as: 'authorizedBy' });

Clients.hasMany(Client_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Client_Associations.belongsTo(Clients)

Company.hasMany(Client_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Client_Associations.belongsTo(Company);

Parent_Account.hasMany(Client_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Client_Associations.belongsTo(Parent_Account);

Child_Account.hasMany(Client_Associations,{
    foriegnKey:{
        allowNull:false
    }
})
Client_Associations.belongsTo(Child_Account);

module.exports = { Clients, Client_Associations }