module.exports = (sequelize, DataTypes) => {
    const Vendors = sequelize.define("Vendors", {
        code: { type:DataTypes.STRING },
        name: { type:DataTypes.STRING },
        city: { type:DataTypes.STRING },
        zip: { type:DataTypes.STRING },
        person1: { type:DataTypes.STRING },
        mobile1: { type:DataTypes.STRING },
        person2: { type:DataTypes.STRING },
        mobile2: { type:DataTypes.STRING },
        telephone1: { type:DataTypes.STRING },
        telephone2: { type:DataTypes.STRING },
        address2: { type:DataTypes.STRING },
        address1: { type:DataTypes.STRING },
        website: { type:DataTypes.STRING },
        accountsMail: { type:DataTypes.STRING },
        infoMail: { type:DataTypes.STRING },
        strn: { type:DataTypes.STRING },
        ntn: { type:DataTypes.STRING },
        registerDate: { type:DataTypes.STRING },
        operations: { type:DataTypes.STRING },
        types: { type:DataTypes.TEXT },
        bankAuthorizeDate: { type:DataTypes.STRING },
        bank: { type:DataTypes.STRING },
        branchName: { type:DataTypes.STRING },
        branchCode: { type:DataTypes.STRING },
        accountNo: { type:DataTypes.STRING },
        iban: { type:DataTypes.STRING },
        swiftCode: { type:DataTypes.STRING },
        routingNo: { type:DataTypes.STRING },
        ifscCode: { type:DataTypes.STRING },
        micrCode: { type:DataTypes.STRING },
        currency: { type:DataTypes.STRING },
        createdBy:{ type:DataTypes.STRING },
        active:{
          type:DataTypes.BOOLEAN
          // defaultValue:0.0
        },
        climaxId: { type:DataTypes.INTEGER },
    })
    return Vendors;
}