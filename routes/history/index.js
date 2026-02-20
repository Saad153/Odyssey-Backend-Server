const routes = require('express').Router();
const { where, Op } = require('sequelize');
const { History, Sequelize } = require('../../models/');
const { Employees } = require('../../functions/Associations/employeeAssociations');

routes.get('/getFormTypes', async(req, res) => {
    try {
        const result = await History.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('formName')), 'formName']
            ],
            raw: true
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.error(error)
        res.json({status:'error', result:error});
    }
});

routes.get('/getTypes', async(req, res) => {
    try {
        const result = await History.findAll({
            attributes: [
                [Sequelize.fn('DISTINCT', Sequelize.col('type')), 'type']
            ],
            raw: true
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.error(error)
        res.json({status:'error', result:error});
    }
});
routes.get('/getHistory', async(req, res) => {
    try {
        console.log(req.headers)
        const condition = {} 
        if(req.headers.form != 'All'){
            condition.formName = req.headers.form
        }
        if(req.headers.action != 'All'){
            condition.type = req.headers.action
        }
        if(req.headers.user != 'All'){
            condition.EmployeeId = req.headers.user
        }
        const result = await History.findAll({
            where: {
                createdAt: {
                    [Op.gte]: req.headers.from,
                    [Op.lte]: req.headers.to
                },
                ...condition
            },
            include: {
                model: Employees,
                as: 'Employee',
                attributes: ['name']
            }
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
        console.error(error)
        res.json({status:'error', result:error});
    }
});


module.exports = routes;