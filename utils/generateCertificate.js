const sharp = require('sharp');
const fs = require('fs-extra');
const path = require('path');
const bwipjs = require('bwip-js');
const axios = require('axios');

// Configuration
const config = {
  // Template paths - now with different paths for each language
  templates: {
    en: path.join(__dirname, '..', 'assets', 'certificate_template_en.png'),
    ar: path.join(__dirname, '..', 'assets', 'certificate_template_ar.png'),
  },

  // Star image path
  starImage: path.join(__dirname, '..', 'assets', 'star.png'),
  // Output settings
  outputFolder: path.join(__dirname, '..', 'uploads', 'certificate'),
  imageDimensions: {
    width: 1263,
    height: 893,
  },

  // Name settings
  name: {
    en: {
      position: { x: 588, y: 335 },
      fontSize: 43,
      color: '#1d5a9b',
    },
    ar: {
      position: { x: 588, y: 335 },
      fontSize: 43,
      color: '#1d5a9b',
    },
  },

  // Course name settings
  course: {
    en: {
      position: { x: 588, y: 640 },
      fontSize: 32,
      color: '#fff',
    },
    ar: {
      position: { x: 588, y: 640 },
      fontSize: 32,
      color: '#fff',
    },
  },

  // Course description settings
  courseDescription: {
    en: {
      position: { x: 588, y: 400 },
      fontSize: 20,
      color: '#1d5a9b',
      maxWidth: 1100, // Maximum width for text wrapping
      lineHeight: 25, // Line height for multi-line descriptions
    },
    ar: {
      position: { x: 588, y: 400 },
      fontSize: 25,
      color: '#1d5a9b',
      maxWidth: 1100,
      lineHeight: 28,
    },
  },

  // Date settings
  date: {
    en: {
      position: { x: 265, y: 800 },
      fontSize: 28,
      color: '#1d5a9b',
      format: 'en-GB',
    },
    ar: {
      position: { x: 265, y: 800 },
      fontSize: 28,
      color: '#1d5a9b',
      format: 'ar-SA',
    },
  },

  // Rating settings
  rating: {
    en: {
      position: { x: 588, y: 685 },
      starSize: 50,
      starSpacing: 55,
    },
    ar: {
      position: { x: 588, y: 685 },
      starSize: 50,
      starSpacing: 55,
    },
  },

  // QR Code settings
  qrCode: {
    en: {
      position: { x: 1000, y: 100 },
      size: 130,
      color: '507cbf',
      background: 'FFFFFF',
    },
    ar: {
      position: { x: 1000, y: 100 },
      size: 130,
      color: '507cbf',
      background: 'FFFFFF',
    },
  },

  // Signature settings
  signature: {
    en: {
      position: { x: 915, y: 780 },
      size: { width: 250, height: 150 },
    },
    ar: {
      position: { x: 915, y: 780 },
      size: { width: 250, height: 150 },
    },
  },
};

// Ensure output directory exists
fs.ensureDirSync(config.outputFolder);

/**
 * Generate QR code buffer using bwip-js with custom colors
 * @param {string} certificateId - The ID to encode in the QR code
 * @param {number} size - The size of the QR code in pixels
 * @param {string} color - The color of the QR code (hex without #)
 * @param {string} background - The background color (hex without #)
 * @returns {Promise<Buffer>} - The QR code as a buffer
 */
async function generateQRCode(certificateId, size, color, background) {
  // Create URL for certificate verification
  const verificationUrl = `http://nexgen-academy.com/en/certificate/${certificateId}`;

  return new Promise((resolve, reject) => {
    bwipjs.toBuffer(
      {
        bcid: 'qrcode', // Barcode type
        text: verificationUrl, // URL to encode in QR
        scale: 3, // Scale factor
        height: 10, // Bar height in millimeters
        width: 10, // Bar width in millimeters
        includetext: false, // No text below the barcode
        backgroundcolor: background, // Background color
        foregroundcolor: color, // QR code color
      },
      (err, png) => {
        if (err) {
          reject(err);
        } else {
          // Resize the QR code to the specified size
          sharp(png).resize(size, size).toBuffer().then(resolve).catch(reject);
        }
      },
    );
  });
}

/**
 * Wraps text to fit within a maximum width
 * @param {string} text - The text to wrap
 * @param {number} maxWidth - Maximum width in characters
 * @returns {Array<string>} - Array of lines
 */
function wrapText(text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0];

  words.slice(1).forEach((word) => {
    if (currentLine.length + word.length + 1 <= maxWidth) {
      currentLine += ` ${word}`;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  lines.push(currentLine); // Add the last line
  return lines;
}

async function generateCertificate(certificateDetails) {
  const {
    studentName,
    courseName,
    courseDescription = '', // New parameter for course description
    rating,
    certificateId,
    language = 'en',
  } = certificateDetails;
  let { signatureImageUrl } = certificateDetails;
  try {
    // Validate language and get the appropriate template
    if (!['en', 'ar'].includes(language)) {
      throw new Error(
        'Unsupported language. Only "en" and "ar" are supported.',
      );
    }

    // Check if template exists for the specified language
    const templatePath = config.templates[language];
    if (!fs.existsSync(templatePath)) {
      throw new Error(
        `Certificate template for language "${language}" not found at path: ${templatePath}`,
      );
    }

    // Check if star image exists
    if (!fs.existsSync(config.starImage)) {
      throw new Error('Star image not found!');
    }

    // Validate signature image URL
    if (!signatureImageUrl) {
      signatureImageUrl =
        'https://development.nexgen-academy.com/users/signatureImage-42760dce-b1e1-4b14-b791-1b0e2bcd15aa-1746300472928.webp';
    }

    // Validate rating
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Validate certificateId
    if (!certificateId) {
      throw new Error('Certificate ID is required for QR code generation');
    }

    // Create output filename
    const outputFilename = `certificate_${studentName.replace(
      /\s+/g,
      '_',
    )}_${language}-${courseName.replace(/\s+/g, '_')}-${Date.now()}.png`;
    const outputPath = path.join(config.outputFolder, outputFilename);

    // Format the course description with line breaks if needed
    const maxCharsPerLine = Math.floor(
      config.courseDescription[language].maxWidth /
        (config.courseDescription[language].fontSize * 0.6),
    );
    const wrappedDescription = wrapText(courseDescription, maxCharsPerLine);

    // Create SVG text overlay
    const date = new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const currentDate =
      language === 'ar'
        ? `${day}/${month}/${year}`
        : date.toLocaleDateString(config.date[language].format, {
            numberingSystem: 'latn',
          });

    // Build description text with proper positioning for multiple lines
    let descriptionSvg = '';
    wrappedDescription.forEach((line, index) => {
      const yPos = Math.round(
        config.courseDescription[language].position.y +
          index * config.courseDescription[language].lineHeight,
      );

      descriptionSvg += `
        <text x="${config.courseDescription[language].position.x}" 
              y="${yPos}" 
              class="description" 
              text-anchor="middle" 
              dominant-baseline="middle">
          ${line}
        </text>
      `;
    });

    const svgText = Buffer.from(`
      <svg width="${config.imageDimensions.width}" height="${config.imageDimensions.height}">
        <style>
          .name { font-size: ${config.name[language].fontSize}px; fill: ${config.name[language].color}; font-family: Arial; }
          .course { font-size: ${config.course[language].fontSize}px; fill: ${config.course[language].color}; font-family: Arial; }
          .date { font-size: ${config.date[language].fontSize}px; fill: ${config.date[language].color}; font-family: Arial; }
          .description { font-size: ${config.courseDescription[language].fontSize}px; fill: ${config.courseDescription[language].color}; font-family: Arial; font-weight: 400; opacity: 0.8;  }

        </style>
        <text x="${config.name[language].position.x}" y="${config.name[language].position.y}" class="name" text-anchor="middle" dominant-baseline="middle">
          ${studentName}
        </text>
        
        <text x="${config.course[language].position.x}" y="${config.course[language].position.y}" class="course" text-anchor="middle" dominant-baseline="middle">
          ${courseName}
        </text>
        
        ${descriptionSvg}
        
        <text x="${config.date[language].position.x}" y="${config.date[language].position.y}" class="date" text-anchor="middle" dominant-baseline="middle">
          ${currentDate}
        </text>
        

      </svg>
    `);

    // Create star overlays
    const starOverlays = await Promise.all(
      Array(rating)
        .fill()
        .map(async (_, i) => {
          // Calculate the offset from center for each star
          const isEven = rating % 2 === 0;
          const centerShift = isEven
            ? config.rating[language].starSpacing / 2
            : 0;
          const centerOffset = Math.round(
            (i - Math.floor(rating / 2)) * config.rating[language].starSpacing +
              centerShift,
          );
          return {
            input: await sharp(config.starImage)
              .resize(
                config.rating[language].starSize,
                config.rating[language].starSize,
              )
              .toBuffer(),
            top: Math.round(
              config.rating[language].position.y -
                config.rating[language].starSize / 2,
            ),
            left: Math.round(
              config.rating[language].position.x +
                centerOffset -
                config.rating[language].starSize / 2,
            ),
          };
        }),
    );

    // Generate QR code with custom colors and verification URL
    const qrCodeSize = config.qrCode[language].size;
    const qrColor = config.qrCode[language].color.replace('#', '');
    const qrBackground = config.qrCode[language].background;

    const qrCodeBuffer = await generateQRCode(
      certificateId,
      qrCodeSize,
      qrColor,
      qrBackground,
    );

    // Add QR code to composite overlays
    const qrCodeOverlay = {
      input: qrCodeBuffer,
      top: Math.round(config.qrCode[language].position.y - qrCodeSize / 2),
      left: Math.round(config.qrCode[language].position.x - qrCodeSize / 2),
    };

    // Download and process signature image from URL

    let signatureBuffer;
    try {
      const response = await axios.get(signatureImageUrl, {
        responseType: 'arraybuffer',
      });
      signatureBuffer = await sharp(Buffer.from(response.data))
        .resize(
          config.signature[language].size.width,
          config.signature[language].size.height,
          { fit: 'inside' },
        )
        .toBuffer();
    } catch (error) {
      throw new Error(
        `Failed to download or process signature image: ${error.message}`,
      );
    }

    // Add signature image overlay
    const signatureOverlay = {
      input: signatureBuffer,
      top: Math.round(
        config.signature[language].position.y -
          config.signature[language].size.height / 2,
      ),
      left: Math.round(
        config.signature[language].position.x -
          config.signature[language].size.width / 2,
      ),
    };

    // Generate the certificate using the language-specific template
    await sharp(templatePath)
      .composite([
        {
          input: svgText,
          top: 0,
          left: 0,
        },
        ...starOverlays,
        qrCodeOverlay, // Add QR code overlay
        signatureOverlay, // Add signature overlay
      ])
      .toFile(outputPath);

    console.log(
      `Certificate generated successfully for ${studentName} in ${language} language with course description and signature. QR code links to: https://development.nexgen-academy.com/api/v1/courses/getCertificate/${certificateId}`,
    );
    return outputFilename;
  } catch (error) {
    console.error('Error generating certificate:', error);
    throw error;
  }
}

module.exports = {
  generateCertificate,
};
