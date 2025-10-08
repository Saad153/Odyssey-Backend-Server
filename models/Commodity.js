module.exports = (sequelize, DataTypes) => {
    const Commodity = sequelize.define("Commodity", {
        name:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        hs:{
            type:DataTypes.STRING
        },
        cargoType:{
            type:DataTypes.STRING
        },
        commodityGroup:{
            type:DataTypes.STRING
        },
        isHazmat:{
            type:DataTypes.STRING
        },
        packageGroup:{
            type:DataTypes.STRING
        },
        hazmatCode:{
            type:DataTypes.STRING
        },
        hazmatClass:{
            type:DataTypes.STRING
        },
        chemicalName:{
            type:DataTypes.STRING
        },
        unoCode:{
            type:DataTypes.STRING
        },
        active:{
            type:DataTypes.STRING
        },
        climaxId:{
            type:DataTypes.INTEGER
        },
    })
    return Commodity;
}