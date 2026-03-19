// Generate bcrypt hash for admin password
const bcrypt = require('bcryptjs');

const password = 'AdminPass123!';
const hash = bcrypt.hashSync(password, 10);

console.log('Bcrypt hash for AdminPass123!:');
console.log(hash);
