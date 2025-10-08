module.exports = (sequelize, DataTypes) => {
    const Employees = sequelize.define("Employees", {
        id:{
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey:true,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        name:{
            type:DataTypes.STRING,
            allowNull: false,
            validate:{
                notEmpty: true
            }
        },
        fatherName:{
            type:DataTypes.STRING,
        },
        email:{
            type:DataTypes.STRING,
        },
        username:{
            type:DataTypes.STRING,
        },
        password:{
            type:DataTypes.STRING,
        },
        contact:{
            type:DataTypes.STRING,
        },
        address:{
            type:DataTypes.STRING,
        },
        cnic:{
            type:DataTypes.STRING,
        },
        designation:{
            type:DataTypes.STRING
        },
        department:{
            type:DataTypes.STRING
        },
        manager:{
            type:DataTypes.STRING
        },
        date:{
            type:DataTypes.STRING
        },
        bank:{
            type:DataTypes.STRING
        },
        account_no:{
            type:DataTypes.STRING
        },
        code:{
            type:DataTypes.STRING,
        },
        active:{
            type:DataTypes.STRING,
        },
        access:{
            type:DataTypes.STRING,
        },
        represent:{
            type:DataTypes.STRING
        },
        createdBy:{
            type:DataTypes.STRING
        },
        updatedBy:{
            type:DataTypes.STRING
        }
    })
    return Employees;
}