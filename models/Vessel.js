module.exports = (sequelize, DataTypes) => {
    const Vessel = sequelize.define("Vessel", {
        code:{
            type:DataTypes.INTEGER,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        carrier:{
            type:DataTypes.STRING
        },
        name:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        type:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        pol:{
            type:DataTypes.STRING,
        },
        destinations:{
            type:DataTypes.STRING,
        },
        climaxId:{
            type:DataTypes.INTEGER,
        },
    })
    return Vessel;
}