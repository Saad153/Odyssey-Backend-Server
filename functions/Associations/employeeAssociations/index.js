const { DataTypes } = require('sequelize')
const { Employees, Access_Levels, Company } = require("../../../models")

Employees.hasMany(Access_Levels, {
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
});
Access_Levels.belongsTo(Employees);

module.exports = { Access_Levels, Employees }