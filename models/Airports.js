module.exports = (sequelize, DataTypes) => {
    const Airports = sequelize.define("Airports", {
        airportCode: {
            type: DataTypes.STRING,
            allowNull: false,
            // NOT `unique: true` here on purpose - see the indexes block below.
            validate: {
                notEmpty: true
            }
        },
        airportName: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        city: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        },
        country: {
            type: DataTypes.STRING,
            allowNull: false,
            validate: {
                notEmpty: true
            }
        }
    }, {
        // Named index rather than an inline `unique: true` on airportCode.
        // sync({alter:true}) cannot match an inline unique constraint against
        // the database, so it added another one on every run -
        // Airports_airportCode_key1 .. _key79, i.e. one per server restart.
        // Sequelize matches entries in `indexes` by name, so this is recognised
        // and left alone. scripts/fixPickListIndexes.js drops the duplicates.
        indexes: [
            { name: "Airports_airportCode_key", unique: true, fields: ["airportCode"] },
        ]
    })
    return Airports
}
