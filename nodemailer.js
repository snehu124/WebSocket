const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'your-email@gmail.com',
        pass: 'your-password'
    }
});

const mailOptions = {
    from: 'your-email@gmail.com',
    to: identifier,
    subject: 'Your OTP for Password Reset',
    text: `Your OTP is: ${otp}`
};

transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
        console.error(err);
        return res.status(500).json({ error: 'Failed to send OTP.' });
    }
    res.json({ message: 'OTP sent.' });
});