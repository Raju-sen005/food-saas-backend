const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",

  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

const sendUpiChangeOtp = async ({
  email,
  restaurantName,
  otp,
}) => {
  const mailOptions = {
    from: `"ChotuGTT Security" <${process.env.SMTP_FROM}>`,
    to: email,
    subject: "UPI ID Change Verification OTP",

    text: `
Hello,

A request was made to change the UPI ID of ${restaurantName}.

Your verification OTP is:

${otp}

This OTP is valid for 10 minutes.

If you did not request this change, please secure your account immediately.

Regards,
ChotuGTT Security Team
    `.trim(),

    html: `
      <div style="font-family:Arial,sans-serif;background:#f8fafc;padding:30px;">
        <div style="
          max-width:520px;
          margin:auto;
          background:white;
          border-radius:16px;
          padding:30px;
          border:1px solid #e2e8f0;
        ">
          <h2 style="margin-top:0;">
            UPI Change Verification
          </h2>

          <p>
            A request was made to change the UPI ID of
            <strong>${restaurantName}</strong>.
          </p>

          <p>Your verification OTP is:</p>

          <div style="
            font-size:32px;
            font-weight:700;
            letter-spacing:8px;
            text-align:center;
            padding:18px;
            background:#f1f5f9;
            border-radius:12px;
            margin:20px 0;
          ">
            ${otp}
          </div>

          <p style="color:#64748b;">
            This OTP is valid for 10 minutes and can only be used
            for this UPI change request.
          </p>

          <p style="color:#dc2626;font-size:13px;">
            If you did not request this change, please secure your
            ChotuGTT account immediately.
          </p>
        </div>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = {
  sendUpiChangeOtp,
};