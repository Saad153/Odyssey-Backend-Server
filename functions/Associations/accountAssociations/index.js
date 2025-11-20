const { DataTypes } = require('sequelize')
const { Accounts, Parent_Account, Child_Account, Company } = require("../../../models")

// Accounts.hasMany(Parent_Account, {
//     foriegnKey:{
//         type: DataTypes.UUID,
//         allowNull:false
//     }
// })
// Parent_Account.belongsTo(Accounts)

Child_Account.hasMany(Child_Account, {
  as: 'children',
  foreignKey: 'ChildAccountId'
});

Child_Account.belongsTo(Child_Account, {
  as: 'parent',
  foreignKey: 'ChildAccountId'
});

// Company.hasMany(Parent_Account, {
//     foriegnKey:{
//         type: DataTypes.UUID,
//         allowNull:false
//     }
// })
// Parent_Account.belongsTo(Company)

module.exports = { Parent_Account, Child_Account }