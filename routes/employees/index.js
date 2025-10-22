const routes = require('express').Router();
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const { Access_Levels, Employees } = require("../../functions/Associations/employeeAssociations")

function getAccessLevels(levels, id){
    let levelsList = [];
    levels.forEach(x => {
        levelsList.push({access_name:x, EmployeeId:id} )
    });
    return levelsList
}

routes.post("/createEmployee", async(req, res) => {
    console.log(req.body)
    try {
        const result = await Employees.findOne({
            where: {
                [Op.or]: [
                  { code:req.body.values.code },
                  { username:req.body.values.userName }
                ]
              }
        })
        if(result){
            res.json({status:'exists'});
        }else{
            const result = await Employees.create({
                name:req.body.values.empName,
                fatherName:req.body.values.fatherName,
                email:req.body.values.email,
                username:req.body.values.userName,
                password:req.body.values.pass,
                contact:req.body.values.phone,
                address:req.body.values.address,
                cnic:req.body.values.cnic,
                designation:req.body.values.selectDesignation,
                department:req.body.values.selectDepart,
                manager:req.body.values.selectManager,
                createdBy:req.body.createdBy,
                //CompanyId:req.body.values.selectCompany,
                date:req.body.values.date,
                bank:req.body.values.bank,
                account_no:req.body.values.accountNo,
                code:req.body.values.code,
                represent:req.body.values.represent,
                active:1
            });
            const resultTwo = await Access_Levels.bulkCreate(getAccessLevels(req.body.values.accessLevels, result.id))
            res.json({status:'success', result:result, resultTwo:resultTwo});
        }
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/editEmployee", async(req, res) => {
    try {
        await Access_Levels.destroy({where:{EmployeeId:req.body.values.id}})
        const result = await Employees.update({
            name:req.body.values.empName,
            fatherName:req.body.values.fatherName,
            email:req.body.values.email,
            username:req.body.values.userName,
            password:req.body.values.pass,
            contact:req.body.values.phone,
            address:req.body.values.address,
            cnic:req.body.values.cnic,
            designation:req.body.values.selectDesignation,
            department:req.body.values.selectDepart,
            manager:req.body.values.selectManager,
            updatedBy:req.body.updatedBy,
            //CompanyId:req.body.values.selectCompany,
            represent:req.body.values.represent,
            date:req.body.values.date,
            bank:req.body.values.bank,
            account_no:req.body.values.accountNo,
            code:req.body.values.code,
            active:1
        }, {where:{id:req.body.values.id}})
        const resultTwo = await Access_Levels.bulkCreate(getAccessLevels(req.body.values.accessLevels, req.body.values.id))
        res.json({status:'success', result:result, resultTwo:resultTwo});
        
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getEmployees", async(req, res) => {
    try {
        const result = await Employees.findAll({include:[
            {
                model:Access_Levels,
                attributes:['id', 'access_name']
            }
        ], where:{active:'1'}})
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getEmployeesIdAndName", async(req, res) => {
    try {
        const result = await Employees.findAll({
         where:{active:'1'},
         attributes:[['id', 'value'], ['name', 'label']]
        })
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getRepresentativeEmployees", async(req, res) => {
    try {
        const Sr = await Employees.findAll({where:{represent: {[Op.substring]: 'sr'} }, attributes:['id', 'name']});
        const Dr = await Employees.findAll({where:{represent: {[Op.substring]: 'dr'} }, attributes:['id', 'name']});
        const Ar = await Employees.findAll({where:{represent: {[Op.substring]: 'ar'} }, attributes:['id', 'name']});
        res.json({status:'success', result:{Sr, Dr, Ar}});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getManagers", async(req, res) => {
    try {
        const result = await Employees.findAll({where:{designation:'manager'}})
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/createAccess", async(req, res) => {
    try {
        const result = await Access_Levels.bulkCreate(req.body);
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});


routes.get('/allRiders', async(req, res) => {
    try {
      const result =  await Employees.findAll({where : {designation:"rider" }})
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
})
module.exports = routes;