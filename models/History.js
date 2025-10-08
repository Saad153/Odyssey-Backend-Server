module.exports = (sequelize, DataTypes) => {
    const History = sequelize.define("History", {
        recordId:{
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
        updateDate:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        html:{
            type:DataTypes.TEXT('long'),
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
    })
    return History;
}
