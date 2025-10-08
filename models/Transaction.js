module.exports = (sequelize, DataTypes) => {
    const Transaction = sequelize.define("Transaction", {
        mode        :{type : DataTypes.STRING},
        tranDate    :{type : DataTypes.STRING},
        subType     :{type : DataTypes.STRING},
        chequeTran  :{type : DataTypes.STRING},
        payAcc      :{type : DataTypes.STRING},
        onAcc       :{type : DataTypes.STRING},
        drawn       :{type : DataTypes.STRING},
        bankCharges :{type : DataTypes.STRING},
        bankAcc     :{type : DataTypes.STRING},
        amount      :{type : DataTypes.STRING},
        exRate      :{type : DataTypes.STRING},
        taxAmount   :{type : DataTypes.STRING},
        taxAc       :{type : DataTypes.STRING},
        gainLoss    :{type : DataTypes.STRING},
        gainLossAc  :{type : DataTypes.STRING},
        payType     :{type : DataTypes.STRING},
        partyType   :{type : DataTypes.STRING},
        partyId     :{type : DataTypes.STRING},
        partyName   :{type : DataTypes.STRING},
        invoices    :{type : DataTypes.TEXT  },
    })
    return Transaction;
}