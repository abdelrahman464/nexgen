export const wrapImageWithServer = (imagePath?: string | null, folder = '') => {
  if (!imagePath) return null;
  const baseURL = process.env.BASE_URL || 'http://localhost:8000';
  if (folder) return `${baseURL}/${folder}/${imagePath}`;
  return `${baseURL}/${imagePath}`;
};

export const wrapImagesWithServer = (imagePaths: string[] | undefined | null, folder = '') => {
  if (!Array.isArray(imagePaths)) return [];
  return imagePaths.map((imagePath) => wrapImageWithServer(imagePath, folder));
};

export const wrapUserImageWithServer = (imagePath?: string | null) => wrapImageWithServer(imagePath, 'users');

export const wrapCourseImageWithServer = (imagePath?: string | null) => wrapImageWithServer(imagePath, 'courses');

export const wrapPostImageWithServer = (imagePath?: string | null) => wrapImageWithServer(imagePath, 'posts');
