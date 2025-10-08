module.exports = (sequelize, DataTypes) => {
    const Delivery_Order = sequelize.define("Delivery_Order", {
        no:                       { type:DataTypes.STRING },
        doNo:                     { type:DataTypes.STRING  },
        date:                     { type:DataTypes.STRING  },
        validDate:                { type:DataTypes.STRING  },
        clearingAgent:            { type:DataTypes.STRING  },
        name:                     { type:DataTypes.STRING  },
        printBy:                  { type:DataTypes.STRING  },
        localCustom:              { type:DataTypes.STRING  },
        deliveryReqTo:            { type:DataTypes.STRING  },
        cnicNo:                   { type:DataTypes.STRING  },
        remarks:                  { type:DataTypes.TEXT('long')},
        returnAt:                 { type:DataTypes.STRING  },
        mobileNo:                 { type:DataTypes.STRING  },
        expDate:                  { type:DataTypes.STRING  },
        acknoledgeEmails:         { type:DataTypes.STRING  },
        endoresementInstruction:  { type:DataTypes.STRING  },
        operation:                { type:DataTypes.STRING  },
        companyId:                { type:DataTypes.STRING  },
        type:                     { type:DataTypes.STRING  },
        indexNo:                  { type:DataTypes.STRING  },
    })
    return Delivery_Order;
}