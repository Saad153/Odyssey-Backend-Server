module.exports = (sequelize, DataTypes) => {
    const SE_Equipments = sequelize.define("SE_Equipments", {
        size:{
            type:DataTypes.STRING
        },
        qty:{
            type:DataTypes.STRING
        },
        dg:{
            type:DataTypes.STRING
        },
        gross:{
            type:DataTypes.STRING
        },
        teu:{
            type:DataTypes.STRING
        }
    })
    return SE_Equipments;
}