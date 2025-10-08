module.exports = (sequelize, DataTypes) => {
    const Tasks = sequelize.define("Tasks", {
        title: { type:DataTypes.STRING },
        category: { type:DataTypes.STRING },
        status: { type:DataTypes.STRING },
        priority:{ type:DataTypes.STRING },
        due:{ type:DataTypes.STRING },
        requestedBy:{ type:DataTypes.STRING },
        assignedBy:{ type:DataTypes.STRING },
    })
    return Tasks;
}