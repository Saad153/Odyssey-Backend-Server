const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Vouchers, Voucher_Heads }=require("../../functions/Associations/voucherAssociations");
const { SE_Job, SE_Equipments, Commodity } = require("../../functions/Associations/jobAssociations/seaExport");
const { Vendors } = require("../../functions/Associations/vendorAssociations");
const { Clients }=require("../../functions/Associations/clientAssociation");
const { Bl } = require('../../functions/Associations/jobAssociations/seaExport');

const { Accounts } = require('../../models/');
const routes=require('express').Router();
const Sequelize=require('sequelize');
const moment = require("moment");
const { Employees } = require("../../functions/Associations/employeeAssociations");
const url = 'profitLoss';
const Op = Sequelize.Op;

routes.get(`/${url}/job`, async(req, res) => {
  try {
    console.log("Headers>>", req.headers)
    let obj = {};
    obj.approved ='true';
    // obj.companyId=req.headers.company;
        // Apply different filters based on the company header value
        if (req.headers.company === '4') {
          obj.companyId = { [Op.in]: ['1', '3'] };
        } else {
          
          obj.companyId = req.headers.company;
          obj.subType = { [Op.in]:req.headers.subtype.split(",")};
        }

       obj.createdAt= {
      [Op.gte]: moment(req.headers.from).toDate(),
      [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
    }
    req.headers.salesrepresentative?obj.salesRepresentatorId=req.headers.salesrepresentative:null;
    req.headers.client?obj.ClientId=req.headers.client:null;
    req.headers.overseasagent?obj.overseasAgentId=req.headers.overseasagent:null;
    req.headers.jobtype?obj.operation=req.headers.jobtype.split(","):null;
    console.log("Object", obj)
    const result = await SE_Job.findAll({
      attributes:['id','jobNo','fd', 'createdAt', 'jobType', 'operation', 'weight',
        'subType','companyId','pcs','pol','exRate','costCenter','nomination',
        'pkgUnit','customerRef','eta','shipDate', 'vol'],
      where:obj,
      include:[
        {
          model:Invoice,
          attributes:['id', 'total', 'payType', 'recieved' , 'paid', 'type', 'status', 'ex_rate', 'currency'],
          where: {
            approved:'1',
          },
          include:[{
            model:Invoice_Transactions
          }]
        },
        { model:Bl, attributes:['hbl','mbl']

        },
        { model:Clients, attributes:['name'] },
        { model:Clients, as:'shipper', attributes:['name'] },
        { model:Clients, as:'consignee', attributes:['name'] },
        { model:Vendors, as:'local_vendor', attributes:['name'] },
        { model:Vendors, as:'overseas_agent', attributes:['name'] },
        { model:Vendors, as:'shipping_line', attributes:['name'] },
        
        { model:SE_Equipments,  attributes:['teu'] },
        { model:Commodity, as:'commodity',  attributes:['name'] },
        
        { model:Employees, as:'sales_representator', attributes:['name'] },
      ]
    });
    console.log("Result", result)
    res.json({status:'success', result:result});

  }
  catch (error) {
    console.log(error)
    res.json({status: 'error', result: error});
  }
});

routes.post(`/${url}/getGainLoss`, async(req, res) => {
  try {
    const result = await Vouchers.findAll({
      where:{invoice_Id:req.body.ids},
      attributes:['exRate', 'vType'],
      include:[{
        model:Voucher_Heads,
        attributes:['amount', 'type', 'defaultAmount'],
        include:[{
          model:Child_Account,
          attributes:['title'],
        }]
      }]
    })
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get(`/${url}/full`, async(req, res) => {
  try {
    const expense = await Accounts.findOne({
      attributes:['title'],
      where:{id:1},
      include:[{
        model:Parent_Account,
        where:{CompanyId:req.headers.id},
        attributes:['title'],
        include:[{
          model:Child_Account,
          attributes:['title'],
          include:[{
            model:Voucher_Heads,
            where:{
              createdAt: {
                [Op.gte]: moment(req.headers.from).toDate(),
                [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
              }
            },
            attributes:['defaultAmount', 'amount', 'type'],
            include:[{
              model:Vouchers,
              attributes:['vType', 'type', 'exRate'],
            }]
          }]
        }]
      }]
    });
    const revenue = await Accounts.findOne({
      attributes:['title'],
      where:{id:2},
      include:[{
        model:Parent_Account,
        where:{CompanyId:req.headers.id},
        attributes:['title'],
        include:[{
          model:Child_Account,
          attributes:['title'],
          // include:[{
          //   model:Voucher_Heads,
          //   where:{
          //     createdAt: {
          //       [Op.gte]: moment(req.headers.from).toDate(),
          //       [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
          //     }
          //   },
          //   attributes:['defaultAmount', 'amount', 'type'],
          //   include:[{
          //     model:Vouchers,
          //     attributes:['vType', 'type', 'exRate'],
          //   }]
          // }]
        }]
      }]
    });
    res.json({status:'success', result:{expense, revenue}});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get(`/${url}/test`, async(req, res) => {
  try {

    let dateObj = {
      createdAt: {
        [Op.gte]: moment(req.headers.from).toDate(),
        [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
      }
    }

    const result = await Child_Account.findAll({
      where:{ParentAccountId:req.headers.id},
      attributes:['title'],
      include:[
        { 
          model:Voucher_Heads,
          where:req.headers.from?dateObj:{},
          attributes:['id', 'amount', 'createdAt'],
          include:[{
            model:Vouchers,
            attributes:['voucher_Id', 'vType'],
          }]
        }
      ]
    })
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get(`/${url}/search`, async(req, res) => {
  try {
    const result = await Employees.findAll({where:{represent: {[Op.substring]: 'sr'} }, attributes:['id', 'name']});
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status:'error', result:error});
  }
});

routes.get(`/${url}/incomeStatement`, async(req, res) => {
  try {
    const result = await Accounts.findAll({
      where:{
        id:[1, 2]
      },
      include:[{
        model:Parent_Account,
        attributes:['id'],
        where:{CompanyId:req.headers.company},
          include:[{
            model:Child_Account,
            attributes:['id', 'title'],
            // order: [[{ model: Voucher_Heads }, 'createdAt', 'DESC']],
            include:[{
              model:Voucher_Heads,
              // order: [['createdAt', 'ASC']],
              attributes:['amount', 'defaultAmount', 'type', 'accountType', 'settlement', 'createdAt'],
              where:{
                createdAt: {
                  [Op.gte]: moment(req.headers.from).toDate(),
                  [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
                }
              },
            }]
          }],
      }]
    })
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

module.exports = routes;