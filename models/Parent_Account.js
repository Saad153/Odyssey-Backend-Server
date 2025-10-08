module.exports = (sequelize, DataTypes) => {
    const Parent_Account = sequelize.define("Parent_Account", {
        title:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        editable:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        code:{
            type:DataTypes.STRING,
        }
    })
    return Parent_Account;
}