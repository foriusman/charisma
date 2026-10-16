const { charge, handler } = require('../../server/payments.cjs');
module.exports = handler(charge);
