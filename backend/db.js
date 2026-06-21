// Lightweight file-based JSON datastore.
// Good enough for a small mini app; swap for Postgres/SQLite later if you scale up.
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

const DEFAULT_DATA = {
  users: {},        // telegramId -> { id, firstName, username, photoUrl, balance, joinedAt }
  ads: {},           // adId -> ad object
  transactions: {},  // txId -> transaction object
  channels: [
    { id: 'darknews', name: 'Dark News', members: 86226, username: '@darknews', country: 'Iran', tags: ['tech'] },
    { id: 'maktab_sharif', name: 'مکتب شریف', members: 14915, username: '@maktab_sharif', country: 'Iran', tags: ['crypto'] },
    { id: 'pinkproxy', name: 'PINK PROXY | پروکسی', members: 1102010, username: '@PinkProxy', country: 'Iran', tags: ['tech'] },
    { id: 'mobailmosavi', name: 'موبایل استقلال', members: 69837, username: '@mobailmosavi4444', country: 'Iran', tags: ['tech'] }
  ]
};

function load() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DATA, null, 2));
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
}

function save(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

module.exports = { load, save };
