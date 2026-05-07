import { Injectable } from '@nestjs/common';

const nodemailer = require('nodemailer');

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  async send(options: SendEmailOptions) {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: process.env.EMAIL_PORT,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      sender: {
        name: process.env.EMAIL_FROM,
      },
    });

    await transporter.sendMail({
      from: {
        name: process.env.EMAIL_FROM,
        address: process.env.EMAIL_USER,
      },
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
  }
}
