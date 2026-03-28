const { DataTypes } = require('sequelize')
const { Accounts, Parent_Account, Child_Account, Company } = require("../../../models")

Child_Account.hasMany(Child_Account, {
  as: 'children',
  foreignKey: 'ChildAccountId'
});

Child_Account.belongsTo(Child_Account, {
  as: 'parent',
  foreignKey: 'ChildAccountId'
});

module.exports = { Parent_Account, Child_Account }