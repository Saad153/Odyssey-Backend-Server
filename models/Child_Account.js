module.exports = (sequelize, DataTypes) => {
    const Child_Account = sequelize.define("Child_Account", {
        title:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        editable:{
            type:DataTypes.STRING,
        },
        subCategory:{
            type:DataTypes.STRING,
        },
        code:{
            type:DataTypes.STRING,
        }
    })
    return Child_Account;
}