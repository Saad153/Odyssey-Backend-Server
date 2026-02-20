module.exports = (sequelize, DataTypes) => {
  const History = sequelize.define(
    "History",
    {
      formName: {
        type: DataTypes.STRING,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING,
        allowNull: false
      },
      docNo: {
        type: DataTypes.STRING,
        allowNull: true
      },
      EmployeeId: {
        type: DataTypes.UUID,
        allowNull: false
      },
    },
    {
      tableName: "History"
    }
  );

  /* =========================
     Associations
     ========================= */
  History.associate = (models) => {
    History.belongsTo(models.Employees, {
      foreignKey: "EmployeeId",
      as: "Employee"
    });
  };

  return History;
};
