const {Notifications } = require('../../functions/Associations/NotificationAssociation')
const { Employees } = require("../../functions/Associations/employeeAssociations");
const routes = require('express').Router();
const Sequelize = require('sequelize');


routes.post('/sendNotification', async(req, res) => {
   try {
    const result =  await Notifications.create(req.body.data)
    res.json({ status: "success", result:result})
       console.log("first")
   }
   catch (err) {
    res.json({ status: "error", result:err.message})

   }
})

routes.get('/getAllNotifications', async(req, res) => {
    try {
        const result =  await Notifications.findAll({
            include: [{model: Employees, as : "createdBy", attributes : ['name']}],
            limit:20,
            order:[["createdAt", "DESC"]],
        })
        res.json({ status: "success", result:result})
       }
       catch (err) {
        res.json({ status: "error", result:err.message})
    
       } 
})
 

routes.post('/updateNotification', async(req, res) => {
    try {
     const result =  await Notifications.update({opened : req.body.data.opened}, {where : {subType : req.body.data.subType}})
     res.json({ status: "success", result:result})
    }
    catch (err) {
     res.json({ status: "error", result:err.message})
 
    }
 })

module.exports = routes