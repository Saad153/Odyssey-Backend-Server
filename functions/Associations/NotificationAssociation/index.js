const {DataTypes} = require("sequelize")
const {Notifications} = require('../../../models')
const {Employees} = require('../../../models')


Notifications.belongsTo(Employees, {as : "createdBy"})

module.exports = { Notifications }