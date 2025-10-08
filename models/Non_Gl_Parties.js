module.exports = (sequelize, DataTypes) => {
  const Non_Gl_Parties = sequelize.define("Non_Gl_Parties", {
      code: { type:DataTypes.INTEGER },
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
      types: { type:DataTypes.STRING },      
      createdBy:{ type:DataTypes.STRING },
      active:{
        type:DataTypes.BOOLEAN,
        // defaultValue:0.0
      },
  })
  return Non_Gl_Parties;
}