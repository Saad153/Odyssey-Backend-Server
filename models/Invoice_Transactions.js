module.exports = (sequelize, DataTypes) => {
    const Invoice_Transactions = sequelize.define("Invoice_Transactions", {
        gainLoss:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        amount:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
    })
    return Invoice_Transactions;
}