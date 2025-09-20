const nodemailer = require('nodemailer');
require('dotenv').config();

class EmailService {
    constructor() {
        this.transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_NAME,
                pass: process.env.EMAIL_PASSWORD
            }
        });
    }

    async sendVerificationEmail(email, firstName, verificationToken) {
        const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email?token=${verificationToken}`;
        
        const mailOptions = {
            from: {
                name: 'Your App Name',
                address: process.env.EMAIL_NAME
            },
            to: email,
            subject: 'Verify Your Email Address',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #333; margin-bottom: 10px;">Welcome ${firstName}!</h1>
                        <p style="color: #666; font-size: 16px;">Please verify your email address to complete your registration</p>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Email Verification Required</h2>
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Thank you for signing up! To ensure the security of your account and complete your registration, 
                            please click the button below to verify your email address.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${verificationUrl}" 
                               style="background-color: #007bff; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; 
                                      display: inline-block;">
                                Verify Email Address
                            </a>
                        </div>
                        
                        <p style="color: #666; font-size: 14px; margin-top: 25px;">
                            If the button doesn't work, copy and paste this link into your browser:
                            <br>
                            <a href="${verificationUrl}" style="color: #007bff; word-break: break-all;">
                                ${verificationUrl}
                            </a>
                        </p>
                    </div>
                    
                    <div style="text-align: center; color: #999; font-size: 12px;">
                        <p>This verification link will expire in 24 hours.</p>
                        <p>If you didn't create an account, please ignore this email.</p>
                    </div>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Verification email sent:', info.messageId);
            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error('Error sending verification email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async sendWelcomeEmail(email, firstName) {
        const mailOptions = {
            from: {
                name: 'Your App Name',
                address: process.env.EMAIL_NAME
            },
            to: email,
            subject: 'Welcome to Our Platform!',
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                    <div style="text-align: center; margin-bottom: 30px;">
                        <h1 style="color: #28a745; margin-bottom: 10px;">Welcome ${firstName}! 🎉</h1>
                        <p style="color: #666; font-size: 16px;">Your email has been successfully verified</p>
                    </div>
                    
                    <div style="background-color: #f8f9fa; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
                        <h2 style="color: #333; margin-bottom: 20px;">Account Successfully Activated</h2>
                        <p style="color: #666; line-height: 1.6; margin-bottom: 25px;">
                            Congratulations! Your account has been successfully verified and activated. 
                            You can now enjoy all the features of our platform.
                        </p>
                        
                        <div style="text-align: center; margin: 30px 0;">
                            <a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/login" 
                               style="background-color: #28a745; color: white; padding: 15px 30px; 
                                      text-decoration: none; border-radius: 5px; font-weight: bold; 
                                      display: inline-block;">
                                Start Exploring
                            </a>
                        </div>
                    </div>
                    
                    <div style="text-align: center; color: #999; font-size: 12px;">
                        <p>Thank you for joining us!</p>
                    </div>
                </div>
            `
        };

        try {
            const info = await this.transporter.sendMail(mailOptions);
            console.log('Welcome email sent:', info.messageId);
            return {
                success: true,
                messageId: info.messageId
            };
        } catch (error) {
            console.error('Error sending welcome email:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }
}

module.exports = new EmailService();