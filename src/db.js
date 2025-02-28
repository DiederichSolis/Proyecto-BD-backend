const driver = require('./conn');

async function closeDriver() {
  await driver.close();
}

module.exports = {
  driver,
  closeDriver
};