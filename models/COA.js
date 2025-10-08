module.exports = (sequelize, DataTypes) => {
    const COA = sequelize.define("COA", {
      title: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: true,
        },
      },
      code: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: true,
        },
      },
      subCategory: {
        type: DataTypes.STRING,
      },
      editable: {
        type: DataTypes.BOOLEAN, // changed from STRING to BOOLEAN (makes more sense as true/false flag)
        defaultValue: true,
      },
      type: {
        type: DataTypes.STRING, // e.g. 'Asset', 'Liability', 'Income', 'Expense'
      },
      parentId: {
        type: DataTypes.INTEGER, // for hierarchical COA
        allowNull: true,
        references: {
          model: "COAs", // pluralized table name
          key: "id",
        },
      },
    });
  
    COA.associate = (models) => {
      // Self association for parent-child COA structure
      COA.hasMany(models.COA, {
        as: 'children',
        foreignKey: 'parentId',
      });
  
      COA.belongsTo(models.COA, {
        as: 'parent',
        foreignKey: 'parentId',
      });
    };
  
    return COA;
  };
  