module.exports = (sequelize, DataTypes) => {
    const AssignTask = sequelize.define("AssignTask", {
        title:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        details:{
            type:DataTypes.TEXT,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
       
    })
    return AssignTask;
}