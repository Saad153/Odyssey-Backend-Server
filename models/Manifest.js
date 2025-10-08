module.exports = (sequelize, DataTypes) => {
    const Manifest = sequelize.define("Manifest", {
        owner_and_operator:{ type:DataTypes.STRING },
        type_of_aircraft:  { type:DataTypes.STRING },
        point_of_loading:  { type:DataTypes.STRING },
        flight_no:         { type:DataTypes.STRING },
        date:              { type:DataTypes.STRING },
        point_of_unloading:{ type:DataTypes.STRING },
        no:                { type:DataTypes.INTEGER},
        job_no:            { type:DataTypes.STRING },
        companyId:         { type:DataTypes.STRING },
        totalWt:           { type:DataTypes.FLOAT  },
        totalPcs:          { type:DataTypes.INTEGER},
        atd:               { type:DataTypes.STRING },
    });
    return Manifest;
}