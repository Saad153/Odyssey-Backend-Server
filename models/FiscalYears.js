module.exports = (sequelize, DataTypes) => {
    const FiscalYears = sequelize.define("FiscalYears", {
        label:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        suffix:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        startDate:{
            type:DataTypes.DATEONLY,
            allowNull: false,
        },
        endDate:{
            type:DataTypes.DATEONLY,
            allowNull: false,
        },
        isLocked:{
            type:DataTypes.BOOLEAN,
            defaultValue: false,
        },
        createdBy:{
            type:DataTypes.STRING,
        },
    })
    return FiscalYears;
}
