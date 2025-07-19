/**
 * Wraps an image path with the server BASE_URL to create a complete image URL
 * @param {string} imagePath - The image path/filename
 * @param {string} folder - The folder where the image is stored (optional)
 * @returns {string} Complete image URL with server base URL
 */
const wrapImageWithServer = (imagePath, folder = "") => {
  if (!imagePath) {
    return null;
  }

  const baseURL = process.env.BASE_URL || "http://localhost:8000";

  // If folder is provided, include it in the path
  if (folder) {
    return `${baseURL}/${folder}/${imagePath}`;
  }

  return `${baseURL}/${imagePath}`;
};

/**
 * Wraps multiple image paths with the server BASE_URL
 * @param {string[]} imagePaths - Array of image paths/filenames
 * @param {string} folder - The folder where the images are stored (optional)
 * @returns {string[]} Array of complete image URLs with server base URL
 */
const wrapImagesWithServer = (imagePaths, folder = "") => {
  if (!Array.isArray(imagePaths)) {
    return [];
  }

  return imagePaths.map((imagePath) => wrapImageWithServer(imagePath, folder));
};

/**
 * Wraps an image path with the server BASE_URL for user profile images
 * @param {string} imagePath - The image path/filename
 * @returns {string} Complete user image URL with server base URL
 */
const wrapUserImageWithServer = (imagePath) =>
  wrapImageWithServer(imagePath, "users");

/**
 * Wraps an image path with the server BASE_URL for course images
 * @param {string} imagePath - The image path/filename
 * @returns {string} Complete course image URL with server base URL
 */
const wrapCourseImageWithServer = (imagePath) =>
  wrapImageWithServer(imagePath, "courses");

/**
 * Wraps an image path with the server BASE_URL for post images
 * @param {string} imagePath - The image path/filename
 * @returns {string} Complete post image URL with server base URL
 */
const wrapPostImageWithServer = (imagePath) =>
  wrapImageWithServer(imagePath, "posts");

module.exports = {
  wrapImageWithServer,
  wrapImagesWithServer,
  wrapUserImageWithServer,
  wrapCourseImageWithServer,
  wrapPostImageWithServer,
};
