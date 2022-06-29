const bcrypt = require("bcrypt");

// generate hash for password
const generateHash = password => {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) reject(err);
      else resolve(hash);
    });
  });
};

// verify hash matches password
const verifyHash = (password, hash) => {
  return new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, res) => {
      if (err) reject(err);
      else resolve(res);
    });
  });
};

module.exports = { generateHash, verifyHash };
