module.exports = (sequelize, DataTypes) => {
    const Item_Details = sequelize.define("Item_Details", {
        noOfPcs:    { type:DataTypes.STRING, defaultValue: "0" },
        unit:       { type:DataTypes.STRING },
        grossWt:    { type:DataTypes.STRING, defaultValue: "0"  },
        kh_lb:      { type:DataTypes.STRING },
        r_class:    { type:DataTypes.STRING },
        itemNo:     { type:DataTypes.STRING },
        chargableWt:{ type:DataTypes.STRING, defaultValue: "0"  },
        rate_charge:{ type:DataTypes.STRING, defaultValue: "0"  },
        total:      { type:DataTypes.STRING, defaultValue: "0"  },
        lineWeight: { type:DataTypes.STRING, defaultValue: "0"  }
    })
    return Item_Details;
}