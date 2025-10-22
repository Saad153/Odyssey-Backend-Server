const { DataTypes } = require('sequelize')
const { Employees, Access_Levels, Company } = require("../../../models")

Employees.hasMany(Access_Levels, {
    foriegnKey:{
        type: DataTypes.INTEGER,
        allowNull:false
    }
});
Access_Levels.belongsTo(Employees);

// Company.hasMany(Employees, {
//     foriegnKey:{
//         type: DataTypes.UUID,
//         allowNull:false
//     }
// });
// Employees.belongsTo(Company);

module.exports = { Access_Levels, Employees }