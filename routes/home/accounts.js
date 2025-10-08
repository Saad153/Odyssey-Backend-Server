
const routes = require('express').Router();
const Sequelize = require('sequelize');
const { Charge_Head, Invoice } = require("../../functions/Associations/incoiceAssociations");
const { SE_Job } = require("../../functions/Associations/jobAssociations/seaExport");
const { Clients } = require("../../functions/Associations/clientAssociation");
const moment = require("moment");
const Op = Sequelize.Op;
const url='accounts';

routes.get(`/${url}/get`, async(req, res) => {
  try {
    const result = await SE_Job.findAll({
      attributes:['id', 'jobNo', 'createdAt', 'subType'],
      include:[
        {
          model:Clients,
          attributes:['name']
        },
        {
          model:Invoice,
          where:{status:'1'},
          include:[
            {
              model:Charge_Head,
              attributes:['net_amount']
            }
          ],
        }
      ],
    }).catch((x)=>console.log(x));
    res.json({status:'success', result:result});
  }
  catch (error) {
    res.json({status: 'error', result: error});
  }
});

module.exports = routes;