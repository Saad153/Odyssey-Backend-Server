const { sequelize } = require("../models");
const { History } = require('../models/');

const createHistory = async (employeeId, formName, Type, docNo) => {
    try {
        const result = await sequelize.transaction(async (t) => {
            const history = await History.create({
                formName: formName,
                type: Type,
                docNo: docNo,
                EmployeeId: employeeId
            }, { transaction: t });
            return true;
        });
    } catch (error) {
        console.error('Error creating history:', error);   
        return false;
    }
}

function getClientIp(req) {
  // If behind a reverse proxy (IIS, nginx, etc.) that sets X-Forwarded-For
  const xff = req.headers['x-forwarded-for'];
  if (xff) {
    // XFF can be a comma-separated list; the first entry is the original client
    return xff.split(',')[0].trim();
  }

  // Direct connection — strip IPv4-mapped IPv6 prefix (::ffff:192.168.1.23 -> 192.168.1.23)
  const remote = req.socket.remoteAddress || req.ip;
  return remote?.replace('::ffff:', '') || 'unknown';
}
module.exports = { createHistory, getClientIp };