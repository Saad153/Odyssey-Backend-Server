const { DataTypes } = require('sequelize')
const { Accounts, Parent_Account, Child_Account, Company } = require("../../../models")

Accounts.hasMany(Parent_Account, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
})
Parent_Account.belongsTo(Accounts)

Parent_Account.hasMany(Child_Account, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
})
Child_Account.belongsTo(Parent_Account)

Company.hasMany(Parent_Account, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
})
Parent_Account.belongsTo(Company)

module.exports = { Parent_Account, Child_Account }