// backend/data/callLogs.js

// Each user has an email and a list of calls
// Each call has: type ("in", "out", "missed"), time, and optionally other info

const callLogs = [
  {
    email: "test@demo.com",
    calls: [
      { type: "in", time: "09:12 AM" },
      { type: "out", time: "10:30 AM" },
      { type: "missed", time: "11:15 AM" },
      { type: "in", time: "01:20 PM" },
      { type: "out", time: "03:45 PM" },
    ],
  },
  {
    email: "maria@demo.com",
    calls: [
      { type: "in", time: "08:45 AM" },
      { type: "out", time: "09:50 AM" },
      { type: "missed", time: "12:10 PM" },
      { type: "in", time: "02:00 PM" },
      { type: "out", time: "04:15 PM" },
    ],
  },
];

module.exports = callLogs