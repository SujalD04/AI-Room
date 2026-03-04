import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export const emailService = {
    /**
     * Send a password reset OTP email.
     */
    async sendOTP(email: string, otp: string) {
        const mailOptions = {
            from: process.env.SMTP_FROM || '"AIRoom" <noreply@airoom.app>',
            to: email,
            subject: 'Your AIRoom Reset Code',
            html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
                    <div style="text-align: center; margin-bottom: 24px;">
                        <h1 style="color: #6366f1; margin: 0; font-size: 28px;">AIRoom</h1>
                    </div>
                    
                    <h2 style="color: #1e293b; margin-top: 0;">Password Reset Request</h2>
                    <p style="color: #475569; line-height: 1.6;">
                        We received a request to reset your password. Use the following code to proceed. This code will expire in 15 minutes.
                    </p>
                    
                    <div style="background-color: #f8fafc; padding: 24px; border-radius: 12px; text-align: center; margin: 24px 0;">
                        <span style="font-size: 36px; font-weight: 800; letter-spacing: 0.25em; color: #6366f1;">${otp}</span>
                    </div>
                    
                    <p style="color: #475569; line-height: 1.6;">
                        If you didn't request this, you can safely ignore this email.
                    </p>
                    
                    <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 32px 0;" />
                    
                    <p style="font-size: 12px; color: #94a3b8; text-align: center;">
                        &copy; ${new Date().getFullYear()} AIRoom. Built for advanced collaboration.
                    </p>
                </div>
            `,
        };

        try {
            const info = await transporter.sendMail(mailOptions);
            console.log('OTP Email sent:', info.messageId);
            return info;
        } catch (error) {
            console.error('Failed to send OTP email:', error);
            throw new Error('Failed to send email. Please try again later.');
        }
    },
};
