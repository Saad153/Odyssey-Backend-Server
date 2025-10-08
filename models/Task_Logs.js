module.exports = (sequelize, DataTypes) => {
    const Task_Logs = sequelize.define("Task_Logs", {
        title: { type:DataTypes.STRING },
        status: { type:DataTypes.INTEGER },
    })
    return Task_Logs;
}