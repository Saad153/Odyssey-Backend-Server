module.exports = (sequelize, DataTypes) => {
    const Voyage = sequelize.define("Voyage", {
        pol:{
            type:DataTypes.STRING,
            allowNull: true,
            validate:{
                notEmpty: true
            }
        },
        pod:{
            type:DataTypes.STRING,
            allowNull: true,
            validate:{
                notEmpty: true
            }
        },
        voyage:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        importOriginSailDate:{
            type:DataTypes.STRING
        },
        importArrivalDate:{
            type:DataTypes.STRING
        },
        exportSailDate:{
            type:DataTypes.STRING
        },
        destinationEta:{
            type:DataTypes.STRING
        },
        cutOffDate:{
            type:DataTypes.STRING
        },
        cutOffTime:{
            type:DataTypes.STRING
        },
        type:{
            type:DataTypes.STRING
        },
        climaxId:{
            type:DataTypes.STRING
        },
    })
    return Voyage;
}