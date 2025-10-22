const { DataTypes } = require('sequelize')
const { Vessel, Voyage} = require("../../../models");


Vessel.hasMany(Voyage,{
    foriegnKey:{
        allowNull:false
    }
})
Voyage.belongsTo(Vessel)


module.exports = { Voyage }