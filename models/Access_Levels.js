module.exports = (sequelize, DataTypes) => {
    const Access_Levels = sequelize.define("Access_Levels", {
        access_name:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
    })
    return Access_Levels;
}