module.exports = (sequelize, DataTypes) => {
    const Vouchers = sequelize.define("Vouchers", {
        voucher_No:{
            type:DataTypes.INTEGER,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        voucher_Id:{
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
        vType:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        currency:{
            type:DataTypes.STRING,
        },
        exRate:{
            type:DataTypes.STRING,
        },
        settleExRate:{
            type:DataTypes.STRING,
        },
        chequeNo:{
            type:DataTypes.STRING,
        },
        chequeDate:{
            type:DataTypes.STRING,
        },
        payTo:{
            type:DataTypes.STRING,
        },
        voucherNarration:{
            type:DataTypes.TEXT
        },
        costCenter:{
            type:DataTypes.STRING,
        },
        invoice_Voucher:{
            type:DataTypes.STRING,
        },
        invoice_Id:{
            type:DataTypes.STRING,
        },
        invoices:{
            type:DataTypes.TEXT,
        },
        drawnAt:{
            type:DataTypes.STRING,
        },
        onAccount:{
            type:DataTypes.STRING,
        },
        partyId:{
            type:DataTypes.STRING,
        },
        partyName:{
            type:DataTypes.STRING,
        },
        partyType:{
            type:DataTypes.STRING,
        },
        tranDate:{
            type:DataTypes.STRING,
        },
        subType:{
            type:DataTypes.STRING,
        },

        createdBy:{
            type:DataTypes.STRING,
        },
    })
    return Vouchers;
}