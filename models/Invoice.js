module.exports = (sequelize, DataTypes) => {
    const Invoice = sequelize.define("Invoice", {
        invoice_No:{
            type:DataTypes.STRING
        },
        invoice_Id:{
            type:DataTypes.INTEGER
        },
        type:{
            type:DataTypes.STRING
        },
        payType:{
            type:DataTypes.STRING
        },
        status:{
            type:DataTypes.STRING
        },
        operation:{
            type:DataTypes.STRING
        },
        currency:{
            type:DataTypes.STRING
        },
        ex_rate:{
            type:DataTypes.STRING
        },
        party_Id:{
            type:DataTypes.STRING
        },
        party_Name:{
            type:DataTypes.STRING
        },
        paid:{
            type:DataTypes.STRING,
            defaultValue: "0",
        },
        recieved:{
            type:DataTypes.STRING,
            defaultValue: "0",
        },
        roundOff:{
            type:DataTypes.STRING,
            defaultValue: "0",
        },
        total:{
            type:DataTypes.STRING,
            defaultValue: "0",
        },
        approved:{
            type:DataTypes.STRING,
            defaultValue: "0",
        },
        companyId:{
            type:DataTypes.STRING,
        },
        partyType:{
            type:DataTypes.STRING,
        },
        climaxId:{
            type:DataTypes.STRING,
        },
        note:{
            type:DataTypes.TEXT
        },
    })
    return Invoice;
}