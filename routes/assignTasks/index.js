const { Employees } = require("../../functions/Associations/employeeAssociations");
const { AssignTask } = require("../../models");
const { Tasks, Sub_Tasks } = require("../../functions/Associations/taskAssociation")
const routes = require('express').Router();
const Sequelize = require('sequelize');

// Old Zahida Work
routes.post('/createTask', async (req, res) =>{
    try {
        const result = await AssignTask.create(req.body).catch((x)=>console.log(x))
        res.json({status:"success", result: result})
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
})

routes.post('/create', async (req, res) =>{
    try {
        const result = await Tasks.create(req.body).catch((x)=>console.log(x));
        await Sub_Tasks.bulkCreate(req.body.subTasks.map((x)=>{ return { ...x, TaskId:result.id } }))
        res.json({
            status:"success", 
            result: result
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.post('/edit', async (req, res) =>{
    try {
        let task = req.body.task;
        await Tasks.update(task, {where:{id:task.id}}).catch((x)=>console.log(x));
        await Sub_Tasks.destroy({where:{id:req.body.deleteList}})
        task.subTasks.forEach((x)=>{ 
            Sub_Tasks.upsert({ ...x, TaskId:task.id }) 
        })
        res.json({
            status:"success"
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.post('/changeTaskStatus', async (req, res) =>{
    try {
        await Tasks.update({status:req.body.status}, {where:{id:req.body.id}}).catch((x)=>console.log(x));
        res.json({
            status:"success"
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.get('/getAllTasks', async (req, res) =>{
    try {
        const result = await Tasks.findAll({
            include:[{
                model:Sub_Tasks
            }]
        });
        res.json({
            status:"success", 
            result: result
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.get('/getAssignedTasks', async (req, res) =>{
    try {
        const result = await Tasks.findAll({
            include:[{
                model:Sub_Tasks
            }],
            where:{
                EmployeeId:req.headers.id
            }
        });
        res.json({
            status:"success", 
            result: result
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.post('/toggleSubTask', async (req, res) =>{
    try {
        const result = await Sub_Tasks.update({status:req.body.status}, { where:{ id:req.body.id }} );
        res.json({
            status:"success", 
            result: result
        })
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.get('/getEmployeeTask', async (req, res) =>{
    try {
        const result = await AssignTask.findAll({where : {EmployeeId : req.headers.id}, 
            include: [{
                model: Employees,
                as: 'assignedBy',
                attributes: ['name']
            }]
        })
        res.json({result: result})
    } 
    catch (error) {
        res.json({status:'error', result:error});
    }
})

module.exports = routes