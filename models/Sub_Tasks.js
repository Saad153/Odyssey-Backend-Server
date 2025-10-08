module.exports = (sequelize, DataTypes) => {
    const Sub_Tasks = sequelize.define("Sub_Tasks", {
        title: { type:DataTypes.STRING },
        status: { type:DataTypes.INTEGER },
    })
    return Sub_Tasks;
}