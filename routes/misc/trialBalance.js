const { Invoice, Invoice_Losses, Invoice_Transactions } = require("../../functions/Associations/incoiceAssociations");
const { Child_Account, Parent_Account } = require("../../functions/Associations/accountAssociations");
const { Vouchers, Voucher_Heads } = require("../../functions/Associations/voucherAssociations");
const { SE_Job } = require("../../functions/Associations/jobAssociations/seaExport");
// const { Vendors } = require("../../functions/Associations/vendorAssociations");
const { Clients } = require("../../functions/Associations/clientAssociation");
const { Accounts } = require('../../models/');
const routes = require('express').Router();
const Sequelize = require('sequelize');
const moment = require("moment");
const url = 'trialBalance';
const Op = Sequelize.Op;

// routes.get(`/${url}/get`, async(req, res) => {
//   try {
//     let obj = {
//       // CompanyId:req.headers.company
//     }
//     if(req.headers.accountid){
//       obj.id = req.headers.accountid
//     }
//     const condition = req.headers.currency!="PKR"
//       ? { currency: req.headers.currency }  // If old is true
//       :null
    
//     console.log(req.headers.currency)
//     const result = await Child_Account.findAll({
//       attributes:['id', 'title', 'code'],
//       where:obj,
//       include:[{
//         model:Child_Account,
//         as: 'children',
//         attributes:['id', 'title', 'code'],
//         include:[{
//           model:Voucher_Heads,
//           attributes:['amount', 'defaultAmount', 'type', 'accountType', 'settlement', 'createdAt', 'narration'],
//           where:{
//             // narration: {
//             //   [Op.ne]: "Opening Balance"
//             // },
//             createdAt: {
//               [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
//             }
//           },
//           include:[{
//             model:Vouchers,
//             // required: false,
//             attributes:['vType', 'type', 'exRate', 'currency'],
//             where:{
//               ...condition,
//               // currency: req.headers.currency,
//               createdAt: {
//                 [Op.gte]: moment(req.headers.from).toDate(),
//                 [Op.lte]: moment(req.headers.to).add(1, 'days').toDate(),
//               }
//             }
//           }]
//         }]
//       }],
//     });
//     // result.forEach((x) => {
//     //   x.dataValues.Child_Accounts.forEach((y) => {
//     //     y.dataValues.Voucher_Heads.forEach((z) => {
//     //       console.log(z.dataValues)
//     //     })
//     //   })
//     // })
//     // console.log(result.dataValues)
//     res.json({status:'success', result:result});
//   }
//   catch (error) {
//     console.error(error)
//     res.json({status: 'error', result: error});
//   }
// });

routes.get(`/${url}/get`, async (req, res) => {
  try {

    const obj = {};
    if (req.headers.accountid) {
      obj.id = req.headers.accountid;
    }

    const condition = req.headers.currency !== "PKR"
      ? { currency: req.headers.currency }
      : null;

    // 1️⃣ Get only accounts that have children — but exclude TOP-LEVEL
    const parents = await Child_Account.findAll({
      attributes: ["id", "title", "code"],
      where: {
        ...obj,
        // ChildAccountId: { [Op.ne]: null }      // exclude top layer
      },
      include: [
        {
          model: Child_Account,
          as: "children",
          attributes: ["id", "title", "code"],

          // 2️⃣ DO NOT LOAD grandchildren
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