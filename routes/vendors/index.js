const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const db = require("../../models");
const routes = require('express').Router();
const { History } = require("../../functions/Associations/historyAssociations");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const { Vendors, Vendor_Associations } = require("../../functions/Associations/vendorAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");

const createAccountList = (parent, child, id) => {
    let result = [];
    parent.forEach((x, i)=>{
        result[i] = {
            VendorId:id,
            CompanyId:x.CompanyId,
            ParentAccountId:x.id,
            ChildAccountId:null
        }
        child.forEach((y, j)=>{
            if(y.ParentAccountId==x.id){
                result[i].ChildAccountId=child[j].id
            }
        })
    })
    //console.log(result)
    return result;
}

const createChildAccounts = (list, name) => {
    let result = [];
    list.forEach((x)=>{
        result.push({title:name, ParentAccountId:x.id, subCategory:'Vendor'})
    });
    return result;
}

routes.post("/addVendor", async(req, res)=>{
    try{
        // console.log(req.body)
        const result = await Vendors.create(req.body)
        console.log(result)
        res.json({
            status:'success', 
            result:result.dataValues
        });
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/createVendorAssociations", async(req, res) => {
    console.log(req.body)
    try{
        const result1 = await Vendors.findOne({
            attributes:['id', 'name'],
            where:{
                name: req.body.name
            }
        })
        const ChAcc = await Child_Account.findOne({
            where:{
                id: req.body.ChildAccountId
            },
            attributes:['id', 'title', 'ParentAccountId'],
        })
        const result = await Vendor_Associations.create({
            VendorId: result1.dataValues.id,
            CompanyId: req.body.companyId,
            ParentAccountId: ChAcc.dataValues.ParentAccountId,
            ChildAccountId: ChAcc.dataValues.id
        });        
        console.log(result.dataValues)
        res.json({status: 'success', result:result.dataValues});
    }catch(e){
        res.json({status:'error', result:e});
        console.error(e)
    }
})

routes.post("/create", async(req, res) => {

    try {
        let value = req.body;
        value.operations = value.operations.join(', ');
        value.types = value.types.join(', ');
        delete value.id;
        const check = await Vendors.findOne({
            attributes:['code'], order: [[ 'createdAt', 'DESC' ]]
        });
        value.accountRepresentatorId = value.accountRepresentatorId==""?null:value.accountRepresentatorId;
        value.authorizedById = value.authorizedById==""?null:value.authorizedById;
        const check2 = await Vendors.findOne({
            where: {
                name: value.name
            }
        })
        if(check2){
            return res.json({status:'exists', message:"Vendor Already Exists"});
        }
        const result = await Vendors.create({...value, code: parseInt(check.code) + 1});
        const accounts = await Parent_Account.findAll({
            where: {
                //CompanyId: { [Op.or]: value.companies },
                title: { [Op.or]: [`${req.body.pAccountName}`] }
            }
        });
        const accountsList = await Child_Account.bulkCreate(createChildAccounts(accounts, result.name));
        await Vendor_Associations.bulkCreate(createAccountList(accounts, accountsList, result.id)).catch((x)=>console.log(x))
        res.json({
            status:'success', 
            accountsList,
            result:result
        });
    }
    catch (error) {
        console.log(error)
      res.json({status:'error', result:error});
    }
});

routes.post("/edit", async(req, res) => {
    try {
        let ids = [];
        let value = req.body.data;
        value.operations = value.operations.join(', ');
        value.types = value.types.join(', ');
        await Vendors.update({...value, code: parseInt(value.code)},{where:{id:value.id}})
        // console.log(req.body.pAccountName);
        const pAccountList = await Parent_Account.findAll({
            where:{title:req.body.pAccountName}
        })
        const vendorAssociation = await Vendor_Associations.findAll({
            where:{VendorId:value.id},
        });
        if(vendorAssociation.length==0){
            console.log("No Vendor Associations")
            const accounts = await Parent_Account.findAll({
              where: {
                //CompanyId: { [Op.or]: value.companies },
                title: { [Op.or]: [`${req.body.pAccountName}`] }
              }
            });
            const accountsList = await Child_Account.bulkCreate(createChildAccounts(accounts, value.name));
            await Vendor_Associations.bulkCreate(createAccountList(accounts, accountsList, value.id)).catch((x)=>console.log(x))
        } else {
            console.log("Vendor Associations")
            vendorAssociation.forEach(async(x)=>{
              ids.push(x.ChildAccountId);
              let tempChildId = pAccountList?.find((y)=>y.CompanyId==x.CompanyId)?.id
              await Vendor_Associations.update({ParentAccountId:tempChildId}, {where:{id:x.id}})
            });
            await Child_Account.update({ title:value.name }, { where:{ id:ids } })
        }
        res.json({status:'success'});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/get", async(req, res) => {
    try {
        const result = await Vendors.findAll({
            // include:[{
            //     model:Vendor_Associations
            // }],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        // console.log(result)
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getVendorById", async(req, res) => {
    try {
        const result = await Vendors.findOne({
            where:{id:req.headers.id},
            include:[{  
                model:Vendor_Associations,
                attributes:['id'],
                include:[{
                    where:{CompanyId:1},
                    attributes:['id', 'title'],
                    model:Parent_Account,
                    include:[{
                        model:Child_Account
                    }]
                }]
            }]
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getForPartySearch", async(req, res) => {
    try {
        const result = await Vendors.findAll({
            attributes:['id', 'name', 'city', 'address1', 'address2', 'mobile1', 'mobile2', 'person2', 'person1', 'types', 'code'],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getForCharges", async(req, res) => {
    try {
        let obj = req.headers.id===undefined?{}:{id:req.headers.id};
        const result = await Vendors.findAll({
            where:obj,
            attributes:["id", "name", "person2", "person1", "mobile1", "mobile2", "address1", "address2", "types", "city"],
            order: [['createdAt', 'DESC'], /* ['name', 'ASC'],*/] 
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/findAccounts", async(req, res) => {
    try {
        console.log(req.body);
        const result = await Parent_Account.findAll({
            where: {
                CompanyId: {
                    [Op.or]: req.body.companies
                },
                title:'Accounts Recievable'
            },
            attributes:['id', 'title']
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.get("/getVendorAssociations", async(req, res) => {
    try {
        const result = await Vendor_Associations.findAll({
            where: {
                CompanyId: req.headers.company
            },
        });
        res.json({status:'success', result:result});
    }
    catch (error) {
      res.json({status:'error', result:error});
    }
});

routes.post("/deleteVendor", async(req, res) => {
    try{
        console.log("Delete Vendor:", req.body.id)
        let vendorId = req.body.id
        const result0 = await Vendors.findOne({where: {
            id: vendorId
        }})
        if(result0){
            const result1 = await Vendor_Associations.findOne({
                where: {
                    VendorId: result0.dataValues.id
                }
            })
            if(result1){
                const result2 = await Child_Account.findOne({
                    where: {
                        id: result1.dataValues.ChildAccountId
                    }
                })
                if(result2){
                    const result3 = await Voucher_Heads.findOne({
                        where: {
                            ChildAccountId: result2.dataValues.id
                        }
                    })
                    if(result3){
                        return res.json({status: 'transaction'})
                    } else {
                        await Child_Account.destroy({
                            where: {
                                id: result2.dataValues.id
                            }
                        })
                        await Vendor_Associations.destroy({
                            where: {
                                id: result1.dataValues.id
                            }
                        })
                        await Vendors.destroy({
                            where: {
                                id: result0.dataValues.id
                            }
                        })
                    }
                } else {
                    await Vendor_Associations.destroy({
                        where: {
                            id: result1.dataValues.id
                        }
                    })
                    await Vendors.destroy({
                        where: {
                            id: result0.dataValues.id
                        }
                    })
                }
            } else {
                await Vendors.destroy({
                    where: {
                        id: result0.dataValues.id
                    }
                })
            }
        } else {
            return res.json({status: 'deleted'})
        }
        console.log(result0.dataValues)
        res.json({status: 'success'})
    }catch(e){
        console.error(e)
        res.json({status: 'error', message: e})
    }
})

module.exports = routes;