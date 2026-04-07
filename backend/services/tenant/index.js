// services/tenant/index.js — Re-export tenant services
const provisioner = require('./provisioner');

module.exports = {
    ...provisioner,
};
