module.exports = (sequelize, DataTypes) => {
    const Stamps = sequelize.define("Stamps", {
        code : {type : DataTypes.STRING},
        stamps : {type : DataTypes.STRING},
        stamp_group : {type : DataTypes.STRING},

    })
    return Stamps;
}