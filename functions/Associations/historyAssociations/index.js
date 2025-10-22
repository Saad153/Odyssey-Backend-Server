const { DataTypes } = require('sequelize')
const { Employees, History } = require("../../../models")

Employees.hasMany(History, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
History.belongsTo(Employees);

module.exports = { History }