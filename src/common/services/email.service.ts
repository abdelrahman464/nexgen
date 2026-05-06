import { Injectable } from '@nestjs/common';

const sendEmail = require('../../../utils/sendEmail');

@Injectable()
export class EmailService {
  send(options: unknown) {
    return sendEmail(options);
  }
}
