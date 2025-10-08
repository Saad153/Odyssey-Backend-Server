module.exports = (sequelize, DataTypes) => {
    const Invoice_Losses = sequelize.define("Invoice_Losses", {
        gainLoss:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
    })
    return Invoice_Losses;
}