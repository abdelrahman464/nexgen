import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { ApiException } from '../exceptions/api.exception';

const User = require('../../../models/userModel');
const CourseProgress = require('../../../models/courseProgressModel');
const Lesson = require('../../../models/lessonModel');

const idVerificationCourseId = () =>
  process.env.ID_VERIFICATION_COURSE_ID || '664697c2ecf273280314ecab';

async function needsIdVerification(user: any) {
  if (user.role === 'admin' || user.idVerification === 'verified') return false;

  try {
    const courseProgress = await CourseProgress.findOne({
      user: user._id,
      course: idVerificationCourseId(),
    })
      .select('course progress')
      .lean();

    if (!courseProgress) return false;
    const totalLessons = await Lesson.countDocuments({ course: courseProgress.course }).lean();
    if (!totalLessons) return false;
    const completedLessons = courseProgress.progress.filter((lesson: any) => lesson.status === 'Completed').length;
    return completedLessons >= Math.ceil(totalLessons / 2);
  } catch (error) {
    console.error('Error in ID verification gate:', error);
    return true;
  }
}

function extractBearerToken(request: any) {
  const authorization = request.headers?.authorization;
  if (authorization && authorization.startsWith('Bearer')) {
    return authorization.split(' ')[1];
  }
  return null;
}

export async function resolveAuthenticatedUser(request: any, enforceAccountState = true) {
  const token = extractBearerToken(request);
  if (!token) throw new ApiException('you are not login,please login first', 401);

  const secret = process.env.JWT_SECRET_KEY;
  if (!secret) throw new ApiException('JWT_SECRET_KEY is required', 500);

  const decoded = jwt.verify(token, secret) as { userId: string; iat?: number };
  const currentUser = await User.findById(decoded.userId);
  if (!currentUser) throw new ApiException('User no longer exists', 401);

  if (currentUser.passwordChangedAt && decoded.iat) {
    const passwordChangedTimestamp = Math.floor(currentUser.passwordChangedAt.getTime() / 1000);
    if (passwordChangedTimestamp > decoded.iat) {
      throw new ApiException('user recently changed his password,please login again', 401);
    }
  }

  if (enforceAccountState) {
    if (!currentUser.emailVerified) throw new ApiException('Please Active Your Email', 407);
    if (!currentUser.active) throw new ApiException('You Are Not Active', 405);
    if (await needsIdVerification(currentUser)) {
      throw new ApiException('You Are Not Verified Your ID Document', 406);
    }
  }

  request.user = currentUser;
  return currentUser;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await resolveAuthenticatedUser(context.switchToHttp().getRequest(), true);
    return true;
  }
}
