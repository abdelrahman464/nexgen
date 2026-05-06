import { HttpException, HttpStatus } from '@nestjs/common';

export class ApiException extends HttpException {
  constructor(message: string, statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR) {
    super({ status: statusCode >= 500 ? 'error' : 'fail', message }, statusCode);
  }
}
