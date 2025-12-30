module.exports = (sequelize, DataTypes) => {
  const Direct_Job = sequelize.define(
    "Direct_Job",
    {
      Entry_No: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Entry number is required"
          },
          is: {
            args: /^[A-Z]{3}-[A-Z]{2}-\d+\/\d{2}$/,
            msg: "Entry number must follow format SNS-DE-101/26"
          }
        }
      },

      Type: {
        type: DataTypes.ENUM("expense", "revenue"),
        allowNull: false
      },

      Reference_No: {
        type: DataTypes.STRING
      },

      Operation: {
        type: DataTypes.ENUM("logistics", "other"),
        allowNull: false
      },

      Job_Type: {
        type: DataTypes.ENUM("single", "multiple"),
        allowNull: false
      },

      SubType: {
        type: DataTypes.ENUM(
          "wire transfer",
          "online transfer",
          "cash",
          "cheque",
          "credit card",
          "po",
          "tt"
        ),
        allowNull: false
      },

      Cheque_No: {
        type: DataTypes.STRING
      },

      Cheque_Date: {
        type: DataTypes.DATE
      },

      Currency: {
        type: DataTypes.ENUM(
          "USD",
          "EUR",
          "GBP",
          "AED",
          "OMR",
          "PKR",
          "BDT",
          "CHF"
        ),
        allowNull: false
      },

      Ex_Rate: {
        type: DataTypes.FLOAT,
        allowNull: false
      },

      Tran_Mode: {
        type: DataTypes.ENUM("Cash", "Bank", "Adjust"),
        allowNull: false
      },

      Drawn_At: {
        type: DataTypes.STRING
      },

      Account_No: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      Paid_To: {
        type: DataTypes.INTEGER,
        allowNull: false
      }
    },
    {
      tableName: "Direct_Jobs"
    }
  );

  /* =========================
     Associations
     ========================= */
  Direct_Job.associate = (models) => {
    Direct_Job.belongsTo(models.Child_Account, {
      foreignKey: "Account_No",
      as: "AccountNo"
    });

    Direct_Job.belongsTo(models.Child_Account, {
      foreignKey: "Paid_To",
      as: "PaidTo"
    });
  };

  return Direct_Job;
};
