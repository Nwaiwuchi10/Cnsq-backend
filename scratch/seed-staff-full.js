const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function seed() {
  const client = new Client({
    host: process.env.DB_HOST || 'aws-1-eu-west-1.pooler.supabase.com',
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USERNAME || 'postgres.zfypcdsudjnlkhzjfunp',
    password: process.env.DB_PAASWORD || 'Chinemerem10',
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // 1. Ensure at least one department exists
  let deptRes = await client.query('SELECT id FROM departments LIMIT 1');
  let deptId;
  if (deptRes.rows.length === 0) {
    const insertedDept = await client.query(`
      INSERT INTO departments (name, "nameAbrv", description, "createdAt", "updatedAt")
      VALUES ('Engineering', 'ENG', 'Software Development Team', NOW(), NOW())
      RETURNING id
    `);
    deptId = insertedDept.rows[0].id;
  } else {
    deptId = deptRes.rows[0].id;
  }

  // 2. Ensure at least one departmental role exists
  let roleRes = await client.query('SELECT id FROM departmental_roles LIMIT 1');
  let roleId;
  if (roleRes.rows.length === 0) {
    const insertedRole = await client.query(`
      INSERT INTO departmental_roles (title, description, "departmentId", "createdAt", "updatedAt")
      VALUES ('Software Engineer', 'Full Stack Developer', $1, NOW(), NOW())
      RETURNING id
    `, [deptId]);
    roleId = insertedRole.rows[0].id;
  } else {
    roleId = roleRes.rows[0].id;
  }

  const users = [
    { email: 'chrysogonusnwaiwu@gmail.com', pass: 'Blessed40', first: 'Chrysogonus', last: 'Nwaiwu', code: 'CNSQ-0001' },
    { email: 'chrispuyol0@gmail.com', pass: 'Blessed40', first: 'Chris', last: 'Puyol', code: 'CNSQ-0002' }
  ];

  for (const u of users) {
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(u.pass, salt);

    // Create / ensure StaffAddress
    const addrRes = await client.query(`
      INSERT INTO staff_addresses (city, state, country, "postalCode", "createdAt", "updatedAt")
      VALUES ('Lagos', 'Lagos State', 'Nigeria', '100001', NOW(), NOW())
      RETURNING id
    `);
    const addressId = addrRes.rows[0].id;

    // Create / ensure StaffEmployment
    const empRes = await client.query(`
      INSERT INTO staff_employment ("employeeCode", "jobTitle", "employmentType", "workMode", "hireDate", "reportingManager", "directReport", status, "department_id", "departmental_role_id", "createdAt", "updatedAt")
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING id
    `, [u.code, ['Software Engineer'], 'Full-Time', 'Onsite', '2026-01-01', 'Admin', 'None', 'Active', deptId, roleId]);
    const employmentId = empRes.rows[0].id;

    // Check if staff exists
    const staffRes = await client.query('SELECT id FROM staff WHERE email = $1', [u.email]);
    if (staffRes.rows.length > 0) {
      console.log(`Updating ${u.email} with employmentId and addressId...`);
      await client.query(`
        UPDATE staff 
        SET password = $1, "employmentId" = $2, "addressId" = $3, "firstName" = $4, "lastName" = $5, "isRegistered" = true
        WHERE email = $6
      `, [hashed, employmentId, addressId, u.first, u.last, u.email]);
    } else {
      console.log(`Inserting full staff ${u.email}...`);
      await client.query(`
        INSERT INTO staff (uuid, "firstName", "lastName", email, phone, password, gender, "employmentId", "addressId", "isRegistered")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      `, [uuidv4(), u.first, u.last, u.email, '080' + Math.floor(Math.random() * 100000000).toString(), hashed, 'Male', employmentId, addressId]);
    }
  }

  console.log('✅ Staff accounts updated with full employment, employeeCode, and address records!');
  await client.end();
}

seed().catch(err => {
  console.error('Error seeding staff:', err);
});
