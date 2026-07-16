module.exports = (sequelize, DataTypes) => {
    const Destinations = sequelize.define("Destinations", {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            validate: {
                notEmpty: true
            }
        }
    })
    return Destinations
}
