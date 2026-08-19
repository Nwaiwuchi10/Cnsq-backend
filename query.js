const { Client } = require('pg');

const client = new Client({
  user: 'postgres',
  password: '1234',
  host: 'localhost',
  port: 5432,
  database: 'connectSquad'
});

client.connect().then(() => {
  client.query('SELECT id, "firstName", "lastName", email FROM staff WHERE "isCeo" = true;', (err, res) => {
    if (err) console.error(err);
    else console.log(JSON.stringify(res.rows, null, 2));
    client.end();
  });
}).catch(console.error);
