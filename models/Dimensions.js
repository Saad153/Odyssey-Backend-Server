module.exports = (sequelize, DataTypes) => {
    const Dimensions = sequelize.define("Dimensions", {
        length:{ type:DataTypes.STRING },
        width:{ type:DataTypes.STRING },
        height:{ type:DataTypes.STRING },
        qty:{ type:DataTypes.STRING },
        vol:{ type:DataTypes.STRING },
        weight:{ type:DataTypes.STRING },
    })
    return Dimensions;
}