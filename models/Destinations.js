module.exports = (sequelize, DataTypes) => {
    const Destinations = sequelize.define("Destinations", {
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            // NOT `unique: true` here on purpose - see the indexes block below.
            validate: {
                notEmpty: true
            }
        }
    }, {
        // The uniqueness is declared as a NAMED index rather than inline on the
        // attribute. An inline `unique: true` becomes a constraint that
        // sync({alter:true}) cannot match against what already exists, so every
        // single sync added another one: Destinations_name_key, _key1, _key2 ...
        // up to _key74, which is one more index per server restart. That reached
        // 432 MB of index on a 10 MB table and made every write to this table
        // maintain 76 indexes.
        //
        // Sequelize matches entries in `indexes` by name, so this one is
        // recognised and left alone. scripts/fixPickListIndexes.js drops the
        // duplicates that were already created.
        indexes: [
            { name: "Destinations_name_key", unique: true, fields: ["name"] },
        ]
    })
    return Destinations
}
