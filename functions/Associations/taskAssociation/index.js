const { DataTypes } = require('sequelize')
const { Employees } = require("../employeeAssociations/");
const { AssignTask, Sub_Tasks, Task_Logs, Tasks } = require("../../../models")

Employees.hasMany(AssignTask, { 
    foriegnKey:{
        type: DataTypes.UUID,
        allowNull:false
    }
})
AssignTask.belongsTo(Employees, {as : "assignedBy"});

Tasks.hasMany(Sub_Tasks,{
    foriegnKey:{
        allowNull:false
    }
})
Sub_Tasks.belongsTo(Tasks);

Employees.hasMany(Tasks,{
    foriegnKey:{
        allowNull:false
    }
})
Tasks.belongsTo(Employees);

Tasks.hasMany(Task_Logs,{
    foriegnKey:{
        allowNull:false
    }
})
Task_Logs.belongsTo(Tasks);

module.exports = { Tasks, Sub_Tasks, Task_Logs, AssignTask }

