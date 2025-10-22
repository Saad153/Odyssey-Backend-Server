const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { Employees } = require("../../functions/Associations/employeeAssociations")
const { History } = require("../../functions/Associations/historyAssociations")

routes.get("/getHistory", async(req, res) => {
    try {
        const result = await History.findAll({ 
            where:{
                recordId:req.headers.recordid,
                type:req.headers.type
            },
            order: [
                ['createdAt', 'DESC'],
            ],
            include:[
            {
                model:Employees,
                attributes:['name']
            }
        ]})
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

//creating history for voucher when it is created
routes.post("/createHistory", async(req, res) => {
    try {
        const {recordid,employeeid} = req.headers;
        const {html,type,updateDate} = req.body;        
        const result = await History.create({
            updateDate,
            html,
            type,
            recordId:recordid,
            EmployeeId:employeeid
        });
        return res.json({ status:"success", result:result})
    }
    catch (error) {
        res.json({status:'error', result:error});
    }
});

routes.get("/viewHistory", async(req, res) => {
    try {
        const { id } = req.headers;

        const result = await History.findAll({
            where: {
                recordId: id,
            },
            attributes: ["createdAt","html","id","type","updateDate"]
        });

        return res.json({ status: "success", result:result});

    } catch (error) {
        console.log(error);
        res.json({ status: 'error', result: error });
    }
});


module.exports = routes;