const { Vouchers } = require("../../functions/Associations/voucherAssociations");
const { SE_Job, SE_Equipments } = require("../../functions/Associations/jobAssociations/seaExport");
const { Invoice, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const Op = Sequelize.Op;

routes.get("/getDashboard", async(req, res) => {

  try {
    const snsFcl = await SE_Job.count({where:{companyId:"1", subType:"FCL", approved:"true"}});
    const snsLCL = await SE_Job.count({where:{companyId:"1", subType:"LCL", approved:"true"}});
    const snsPending = await SE_Job.count({where:{companyId:"1", approved:"false"}});

    const acsFcl = await SE_Job.count({where:{companyId:"3", subType:"FCL", approved:"true"}});
    const acsLCL = await SE_Job.count({where:{companyId:"3", subType:"LCL", approved:"true"}});
    const acsPending = await SE_Job.count({where:{companyId:"3", approved:"false"}});

    const lastWeek = `${moment().subtract(1, 'week' ).format("YYYY-MM-DD")}`
    const lastMonth =`${moment().subtract(1, 'month').format("YYYY-MM-DD")}`
    const lastYear = `${moment().subtract(1, 'year' ).format("YYYY-MM-DD")}`

    const weekCount = await SE_Job.count({where:{createdAt:{[Op.gte]:moment(lastWeek).toDate()}}});
    const monthCount= await SE_Job.count({where:{createdAt:{[Op.gte]:moment(lastMonth).toDate()}}});
    const yearCount = await SE_Job.count({where:{createdAt:{[Op.gte]:moment(lastYear).toDate()}}});

    const projSales = await Invoice.findAll({ where:{payType:'Recievable', approved:'1'}, attributes:['total']});

    res.json({
      status:'success', result:{
        sns:{ snsFcl, snsLCL, snsPending },
        acs:{ acsFcl, acsLCL, acsPending },
        weekCount, monthCount, yearCount,
        invocies:{
          projSales
        }
      }
    });
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get("/getCashFlow", async(req, res) => {
  try {
    const cashflow = await Vouchers.findAll({
      raw:true,
      where:{type:'Job Reciept'},
      attributes:['id', 'createdAt'],
      include:[{
        model:Invoice_Transactions,
        attributes:['amount']
      }]
    });
    const cashexpenditure = await Vouchers.findAll({
      raw:true,
      where:{type:'Job Payment'},
      attributes:['id', 'createdAt'],
      include:[{
        model:Invoice_Transactions,
        attributes:['amount']
      }]
    });
    res.json({ status:'success', result:{
      cashflow,
      cashexpenditure
    } });
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

routes.get("/getCashFlowTwo", async(req, res) => {
  try {
    const values = await Vouchers.findAll({
      raw:true,
      where:{
        [Op.or]:[
          { type:'Job Reciept' },
          { type:'Job Payment' },
        ]
      },
      attributes:['id', 'createdAt', 'type'],
      include:[{
        model:Invoice_Transactions,
        attributes:['amount']
      }]
    });
    res.json({ status:'success', result:values });
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

module.exports = routes;