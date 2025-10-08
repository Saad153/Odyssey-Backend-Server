module.exports = (sequelize, DataTypes) => {
    const Charges = sequelize.define("Charges", {
        code:{
            type:DataTypes.INTEGER,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        currency:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        name:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        short:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        calculationType:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        defaultPaybleParty:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        defaultRecivableParty:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        taxApply:{
            type:DataTypes.STRING,
            allowNull: false,
        },
        taxPerc:{
            type:DataTypes.STRING,
            allowNull: false,
        },
        fixAmount:{
            type:DataTypes.DOUBLE,  
            defaultValue:0.0
        },
    })
    return Charges;
}