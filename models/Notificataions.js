module.exports = (sequlize, DataTypes) => {
const Notifications = sequlize.define("Notifications", {
    type:           {type : DataTypes.STRING},
    subType :       {type : DataTypes.STRING},
    notification :  {type : DataTypes.TEXT},
    recordId :      {type : DataTypes.STRING},
    companyId :     {type : DataTypes.STRING},
    currency :      {type : DataTypes.STRING},
    opened :        {type : DataTypes.STRING},
    
})
return Notifications
}