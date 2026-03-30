const { Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Vouchers, Voucher_Heads } = require("../../functions/Associations/voucherAssociations");
const { SE_Job } = require("../../functions/Associations/jobAssociations/seaExport");
const { Clients } = require("../../functions/Associations/clientAssociation");
const { Accounts } = require('../../models/');
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const url = 'trialBalance';
const Op = Sequelize.Op;

routes.get(`/${url}/get`, async (req, res) => {
  try {

    const obj = {};
    if (req.headers.accountid && req.headers.accountid !== 'null') {
      obj.id = req.headers.accountid;
    }
    
    const condition = {
      ...(req.headers.currency !== 'PKR' && { currency: req.headers.currency }),
      ...(req.headers.company && { CompanyId: req.headers.company }),
    };

    const parents = await Child_Account.findAll({
      attributes: ["id", "title", "code"],
      where: {
        ...obj,
      },
      include: [
        {
          model: Child_Account,
          as: "children",
          attributes: ["id", "title", "code"],

          include: [
            {
              model: Voucher_Heads,
              attributes: [
                "amount",
                "defaultAmount",
                "type",
                "accountType",
                "settlement",
                "createdAt",
                "narration"
              ],
              where: {
                createdAt: {
                  [Op.lte]: moment(req.headers.to).add(1, "days").toDate(),
                },
              },
              include: [
                {
                  model: Vouchers,
                  attributes: ["vType", "type", "exRate", "currency"],
                  where: {
                    ...condition,
                    createdAt: {
                      [Op.gte]: moment(req.headers.from).toDate(),
                      [Op.lte]: moment(req.headers.to).add(1, "days").toDate(),
                    },
                  },
                },
              ],
            },
          ],
        },
      ],
    });

    res.json({ status: "success", result: parents });
  } catch (error) {
    console.error(error);
    res.json({ status: "error", result: error });
  }
});


module.exports = routes;