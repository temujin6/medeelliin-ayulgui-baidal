const nodemailer = require("nodemailer");
require("dotenv").config();
const { logger } = require("./log");

async function sendEmail(to: any, subject: any, message: any) {
  try {
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER, // generated ethereal user
        pass: process.env.EMAIL_PASS, // generated ethereal password
      },
    });

    // send mail with defined transport object
    let info = await transporter.sendMail({
      from: `"EBuuhia 🚀" <${process.env.EMAIL}>`, // sender address
      to, // list of receivers
      subject, // Subject line// plain text body
      html: message, // html body
    });

    console.log("Message sent: %s", info.messageId);
    // Message sent: <b658f8ca-6296-ccf4-8306-87d57a0b4321@example.com>

    // Preview only available when sending through an Ethereal account
    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
    logger.info("Successfully sent!");
  } catch (err) {
    logger.error(err);
    throw new Error("Email error");
  }
}

module.exports = {
  sendEmail,
};
