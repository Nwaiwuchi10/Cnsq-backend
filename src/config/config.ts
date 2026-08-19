export default () => ({
  jwt: {
    secret: process.env.JWT_SECRET,

    expiresIn: process.env.JWT_EXPIRES || '365d',
    // expiresIn: process.env.JWT_EXPIRES || '365d',
  },
  ceoEmail: process.env.CEO_EMAIL,
});
