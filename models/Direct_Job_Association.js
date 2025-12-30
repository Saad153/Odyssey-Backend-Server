module.exports = (sequelize, DataTypes) => {
  const Direct_Job_Association = sequelize.define(
    "Direct_Job_Association",
    {
      Job_No: {
        type: DataTypes.STRING,
        allowNull: false,
        validate: {
          notEmpty: {
            msg: "Entry number is required"
          },
          is: {
            args: /^[A-Z]{3}-[A-Z]+-\d+\/\d{2}$/,
            msg: "Entry number must follow format SNS-SE-101/26"
          }
        }
      },
      File_No: {
        type: DataTypes.STRING
      },
      Charge_Name: {
        type: DataTypes.STRING,
        allowNull: false
      },

      Basis: {
        type: DataTypes.STRING,
      },

      Rate_Group: {
        type: DataTypes.STRING,
      },

      Size_Type: {
        type: DataTypes.STRING
      },

      Quantity: {
        type: DataTypes.INTEGER,
        allowNull: false
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
        type: DataTypes.DECIMAL(18, 6),
        allowNull: false
      },

      Amount: {
        type: DataTypes.DECIMAL(18, 6),
        allowNull: false
      },

      Discount: {
        type: DataTypes.DECIMAL(18, 6)
      },

      Tax_Apply: {
        type: DataTypes.BOOLEAN,
        allowNull: false
      },

      Tax_Amount: {
        type: DataTypes.DECIMAL(18, 6)
      },

      VAT_Catagory: {
        type: DataTypes.STRING
      },

      Description: {
        type: DataTypes.STRING
      },

      Job_Id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      Voucher_Id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

      Direct_Job_Id: {
        type: DataTypes.INTEGER,
        allowNull: false
      },

    },
    {
      tableName: "Direct_Job_Association"
    }
  );

  /* =========================
     Associations
     ========================= */
  Direct_Job_Association.associate = (models) => {
    Direct_Job_Association.belongsTo(models.SE_Job, {
      foreignKey: "Job_Id",
      as: "Job"
    });

    Direct_Job_Association.belongsTo(models.Vouchers, {
      foreignKey: "Voucher_Id",
      as: "Voucher"
    });

    Direct_Job_Association.belongsTo(models.Direct_Job, {
      foreignKey: "Direct_Job_Id",
      as: "DirectJob"
    });
  };

  return Direct_Job_Association;
};
