module.exports = (sequelize, DataTypes) => {
  const Email_Suggestion = sequelize.define(
    "Email_Suggestion",
    {
      email: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
      },
      usageCount: {
        type: DataTypes.INTEGER,
        defaultValue: 1,
      },
      lastUsedAt: {
        type: DataTypes.DATE,
      },
    },
    {
      tableName: "Email_Suggestions",
    }
  );

  return Email_Suggestion;
};
