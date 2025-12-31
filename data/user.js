const bcrypt = require("bcryptjs");

const users = [
  {
    name: "Maria Shaikh",
    email: "test@demo.com",
    password: bcrypt.hashSync("123456", 10),
    role: "agent",
  },
];

module.exports = users;
