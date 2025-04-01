const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = require('canvas');

/**
 * Generates a certificate with the given name and course name
 * @param {string} name - The recipient's name
 * @param {string} courseName - The name of the completed course
 * @returns {Promise<string>} - Path to the generated certificate
 */
const generateCertificate = async (name, courseName) => {
  // Create canvas for the certificate
  const canvas = createCanvas(1000, 600);
  const ctx = canvas.getContext('2d');

  try {
    // Create uploads and certificate directories if they don't exist
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    const certificateDir = path.join(uploadsDir, 'certificate');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    if (!fs.existsSync(certificateDir)) {
      fs.mkdirSync(certificateDir, { recursive: true });
    }

    // Draw a default background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 10;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Draw decorative inner border
    ctx.strokeStyle = '#4a86e8';
    ctx.lineWidth = 2;
    ctx.strokeRect(35, 35, canvas.width - 70, canvas.height - 70);

    // Add decorative corners
    const cornerSize = 50;
    ctx.fillStyle = '#4a86e8';
    // Top left
    ctx.beginPath();
    ctx.moveTo(20, 20);
    ctx.lineTo(20 + cornerSize, 20);
    ctx.lineTo(20, 20 + cornerSize);
    ctx.fill();
    // Top right
    ctx.beginPath();
    ctx.moveTo(canvas.width - 20, 20);
    ctx.lineTo(canvas.width - 20 - cornerSize, 20);
    ctx.lineTo(canvas.width - 20, 20 + cornerSize);
    ctx.fill();
    // Bottom left
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 20);
    ctx.lineTo(20 + cornerSize, canvas.height - 20);
    ctx.lineTo(20, canvas.height - 20 - cornerSize);
    ctx.fill();
    // Bottom right
    ctx.beginPath();
    ctx.moveTo(canvas.width - 20, canvas.height - 20);
    ctx.lineTo(canvas.width - 20 - cornerSize, canvas.height - 20);
    ctx.lineTo(canvas.width - 20, canvas.height - 20 - cornerSize);
    ctx.fill();

    // Try to load logo
    let logoImage = null;
    try {
      const logoPath = path.join(__dirname, 'iconicLogo.png');
      if (fs.existsSync(logoPath)) {
        logoImage = await loadImage(logoPath);
        // Draw logo at top center
        const logoWidth = 150;
        const logoHeight = 80;
        ctx.drawImage(
          logoImage,
          (canvas.width - logoWidth) / 2,
          40,
          logoWidth,
          logoHeight,
        );
      } else {
        // Draw placeholder logo
        ctx.fillStyle = '#4a86e8';
        ctx.beginPath();
        ctx.arc(canvas.width / 2, 70, 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 30px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('LOGO', canvas.width / 2, 70);
      }
    } catch (error) {
      console.warn('Could not load logo, using placeholder', error);
      // Draw placeholder logo
      ctx.fillStyle = '#4a86e8';
      ctx.beginPath();
      ctx.arc(canvas.width / 2, 70, 40, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 30px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('LOGO', canvas.width / 2, 70);
    }

    // Configure text styling
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const centerX = canvas.width / 2;

    // Add certificate title - position adjusted to account for logo
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('CERTIFICATE OF COMPLETION', centerX, 150);

    // Add "This certifies that" text
    ctx.font = '24px Arial';
    ctx.fillText('This certifies that', centerX, 200);

    // Add name
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(name, centerX, 250);

    // Add "has successfully completed" text
    ctx.font = '24px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText('has successfully completed', centerX, 310);

    // Add course name
    ctx.font = 'bold 36px Arial';
    ctx.fillStyle = '#000';
    ctx.fillText(courseName, centerX, 360);

    // Add date
    const today = new Date();
    const formattedDate = today.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    ctx.font = '20px Arial';
    ctx.fillStyle = '#333';
    ctx.fillText(formattedDate, centerX, 420);

    // Try to load signature image
    let signatureImage = null;
    try {
      const signaturePath = path.join(__dirname, 'iconicLogo.png');
      if (fs.existsSync(signaturePath)) {
        signatureImage = await loadImage(signaturePath);
        // Draw signature above the line
        const sigWidth = 150;
        const sigHeight = 60;
        ctx.drawImage(
          signatureImage,
          centerX - sigWidth / 2,
          465 - sigHeight,
          sigWidth,
          sigHeight,
        );
      } else {
        // Draw placeholder signature
        ctx.font = 'italic 30px "Times New Roman"';
        ctx.fillStyle = '#000';
        ctx.fillText('John Smith', centerX, 465);
      }
    } catch (error) {
      console.warn('Could not load signature, using placeholder', error);
      // Draw placeholder signature
      ctx.font = 'italic 30px "Times New Roman"';
      ctx.fillStyle = '#000';
      ctx.fillText('John Smith', centerX, 465);
    }

    // Add signature line
    ctx.beginPath();
    ctx.moveTo(centerX - 100, 500);
    ctx.lineTo(centerX + 100, 500);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = '18px Arial';
    ctx.fillText('Authorized Signature', centerX, 520);

    // Create the specified output path
    const outputPath = path.join(
      certificateDir,
      `${courseName}-${Date.now()}-${name}.png`,
    );

    // Save the image
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`Certificate generated successfully: ${outputPath}`);
    return outputPath;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
};

/**
 * Example usage:
 *
 * generateCertificate('John Doe', 'Advanced JavaScript Programming')
 *   .then(path => console.log(`Certificate saved at: ${path}`))
 *   .catch(err => console.error(err));
 */

module.exports = generateCertificate;
