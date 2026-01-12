const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const ApiError = require('../utils/apiError');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Convert image file to base64
 * @param {string} imagePath - Path to the image file
 * @returns {string} Base64 encoded image
 */
const imageToBase64 = (imagePath) => {
  try {
    const imageBuffer = fs.readFileSync(imagePath);
    return imageBuffer.toString('base64');
  } catch (error) {
    throw new ApiError(`Error reading image file: ${error.message}`, 400);
  }
};

/**
 * Verify ID document using OpenAI Vision API
 * @param {string[]} imagePaths - Array of image file paths
 * @param {Object} userData - User data to verify against (name, idNumber, etc.)
 * @returns {Object} Verification result with extracted data and verification status
 */
const verifyIdentityWithOpenAI = async (imagePaths, userData = {}) => {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new ApiError('OpenAI API key is not configured', 500);
    }

    if (!imagePaths || imagePaths.length === 0) {
      throw new ApiError('No images provided for verification', 400);
    }

    // Process all images
    const imagePromises = imagePaths.map(async (imagePath) => {
      let fullPath;

      // Handle different path formats:
      // 1. Full URL (http://localhost:8000/users/idDocuments/filename.webp)
      // 2. Absolute path (/uploads/users/idDocuments/filename.webp)
      // 3. Relative path (filename.webp)
      if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
        // Extract filename from URL
        const urlParts = imagePath.split('/');
        const filename = urlParts[urlParts.length - 1];
        fullPath = path.join(
          __dirname,
          '..',
          'uploads',
          'users',
          'idDocuments',
          filename,
        );
      } else if (imagePath.startsWith('/')) {
        // Absolute path - use as is
        fullPath = imagePath;
      } else {
        // Relative path - join with uploads directory
        fullPath = path.join(
          __dirname,
          '..',
          'uploads',
          'users',
          'idDocuments',
          imagePath,
        );
      }

      if (!fs.existsSync(fullPath)) {
        console.error(`Image file not found: ${fullPath} (from: ${imagePath})`);
        throw new ApiError(`Image file not found: ${imagePath}`, 404);
      }

      const base64Image = imageToBase64(fullPath);

      // Detect image format from file extension
      const ext = path.extname(fullPath).toLowerCase();
      let mimeType = 'image/jpeg'; // default
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';
      else if (ext === '.gif') mimeType = 'image/gif';

      return {
        type: 'image_url',
        image_url: {
          url: `data:${mimeType};base64,${base64Image}`,
        },
      };
    });

    const images = await Promise.all(imagePromises);

    // Create the prompt for OpenAI Vision
    const systemPrompt = `You are an expert identity verification system specializing in international ID documents. Your task is to analyze ID document images and extract information from documents in ANY language (Arabic, English, Kurdish, etc.). You MUST respond with ONLY a valid JSON object - no explanations, no apologies, no markdown, just pure JSON.

IMPORTANT: You can read and extract text in Arabic, Kurdish, English, and other languages. Extract names exactly as they appear on the document, preserving the original language/script.

Supported Document Types:
- Iraqi National ID Card (البطاقة الوطنية العراقية)
- Passports from any country
- Driver's licenses
- Other government-issued ID cards

Required JSON structure:
{
  "documentType": "string (e.g., 'Iraqi National ID', 'ID card', 'passport', 'driver license')",
  "extractedName": "string (full name from document in original language/script, combine first name + father + grandfather + surname if applicable, or null if not found)",
  "extractedIdNumber": "string (national ID number, passport number, or document number, or null if not found)",
  "dateOfBirth": "string (YYYY-MM-DD format, or null if not found)",
  "expiryDate": "string (YYYY-MM-DD format, or null if not found)",
  "nationality": "string (country name in English, e.g., 'Iraq', 'Jordan', or null if not found)",
  "isAuthentic": boolean (true if document appears authentic with no signs of tampering, false if clearly tampered/forged),
  "confidence": number (0-100, your confidence in the analysis based on image quality and document clarity),
  "issues": ["array of issues found, e.g., 'Low image quality', 'Document appears tampered', 'Text not clearly visible', empty array [] if none"],
  "verificationStatus": "verified" (if document is clear, authentic, and all information is readable), "rejected" (if document is clearly fake/tampered), or "needs_review" (if uncertain or image quality is poor)
}

For Iraqi National ID Cards specifically:
- Extract the full name combining: الاسم (Name) + الاب (Father) + الجد (Grandfather) + اللقب (Surname)
- The national card number is typically 12 digits
- Look for text in both Arabic and Kurdish

CRITICAL: If you cannot see the images clearly or encounter any issues, still return valid JSON with verificationStatus set to "needs_review" and describe the issue in the issues array. NEVER return text explanations - only JSON.`;

    const userPrompt = `Analyze the provided ID document images carefully. Extract all visible information including text in Arabic, Kurdish, English, or any other language. Verify the document's authenticity by checking for signs of tampering, forgery, or manipulation. Compare extracted information with user data if provided. Return ONLY the JSON object matching the required structure - no other text.${
      userData.name ? ` User claims name: ${userData.name}` : ''
    }${
      userData.idNumber ? ` User claims ID number: ${userData.idNumber}` : ''
    }`;

    // Call OpenAI Vision API
    // Try with response_format first (forces JSON), fallback if not supported
    let response;
    try {
      response = await openai.chat.completions.create({
        model: 'gpt-4o', // gpt-4o supports response_format
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [{ type: 'text', text: userPrompt }, ...images],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1, // Low temperature for more consistent results
        response_format: { type: 'json_object' }, // Force JSON response
      });
    } catch (formatError) {
      // If response_format is not supported, retry without it
      console.warn(
        'response_format not supported, retrying without it:',
        formatError.message,
      );
      response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: [{ type: 'text', text: userPrompt }, ...images],
          },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });
    }

    // Parse the response
    const { choices } = response;
    const { message } = choices[0];
    const { content } = message;
    let verificationResult;

    try {
      let jsonString = content.trim();

      // Strategy 1: Try to extract JSON from markdown code blocks (```json ... ``` or ``` ... ```)
      const markdownJsonMatch = jsonString.match(
        /```(?:json)?\s*(\{[\s\S]*\})\s*```/,
      );
      if (markdownJsonMatch && markdownJsonMatch[1]) {
        jsonString = markdownJsonMatch[1].trim();
      } else {
        // Strategy 2: Try to find JSON object in the response (handle nested objects)
        // Find the first { and match until the last } to handle nested JSON
        const firstBrace = jsonString.indexOf('{');
        const lastBrace = jsonString.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          jsonString = jsonString.substring(firstBrace, lastBrace + 1);
        } else {
          // Fallback: try the original regex
          const jsonObjectMatch = jsonString.match(/\{[\s\S]*\}/);
          if (jsonObjectMatch) {
            jsonString = jsonObjectMatch[0];
          }
        }
      }

      // Try to parse the JSON
      verificationResult = JSON.parse(jsonString);

      // Validate that we have the required fields
      if (!verificationResult.verificationStatus) {
        verificationResult.verificationStatus = 'needs_review';
      }
      if (typeof verificationResult.confidence !== 'number') {
        verificationResult.confidence = verificationResult.confidence || 0;
      }
      if (!Array.isArray(verificationResult.issues)) {
        verificationResult.issues = verificationResult.issues
          ? [verificationResult.issues]
          : [];
      }
    } catch (parseError) {
      // Log the error and raw response for debugging
      console.error('JSON Parse Error:', parseError.message);
      console.error(
        'Raw AI Response (first 500 chars):',
        content.substring(0, 500),
      );

      // Check if the response contains an error message we can extract
      let errorMessage =
        'AI verification failed - response could not be parsed';
      if (
        content.toLowerCase().includes("i'm sorry") ||
        content.toLowerCase().includes('i cannot')
      ) {
        errorMessage =
          'AI could not process the images - please ensure images are clear and readable';
      } else if (
        content.toLowerCase().includes('error') ||
        content.toLowerCase().includes('unable')
      ) {
        errorMessage = 'AI encountered an error processing the documents';
      }

      // If parsing fails, create a structured response from the text
      verificationResult = {
        documentType: 'unknown',
        extractedName: null,
        extractedIdNumber: null,
        dateOfBirth: null,
        expiryDate: null,
        nationality: null,
        isAuthentic: false,
        confidence: 0,
        issues: [errorMessage],
        verificationStatus: 'needs_review',
        rawResponse: content.substring(0, 1000), // Store first 1000 chars for debugging
      };
    }

    // Compare extracted data with user data if provided
    if (userData.name && verificationResult.extractedName) {
      // Normalize names: remove extra spaces, convert to lowercase for comparison
      const normalizeName = (name) =>
        name.toLowerCase().replace(/\s+/g, ' ').trim().replace(/[،,]/g, ''); // Remove Arabic and English commas

      const extractedNormalized = normalizeName(
        verificationResult.extractedName,
      );
      const userNormalized = normalizeName(userData.name);

      // Check if names match (either contains the other, or exact match)
      // For Arabic names, the extracted name might be full (first + father + grandfather + surname)
      // while user name might be shorter, so we check if user name is contained in extracted name
      const nameMatch =
        extractedNormalized === userNormalized ||
        extractedNormalized.includes(userNormalized) ||
        userNormalized.includes(extractedNormalized) ||
        // Check if key parts match (for compound Arabic names)
        (extractedNormalized
          .split(' ')
          .some((part) => userNormalized.split(' ').includes(part)) &&
          userNormalized
            .split(' ')
            .some((part) => extractedNormalized.split(' ').includes(part)));

      verificationResult.nameMatch = nameMatch;
    }

    if (userData.idNumber && verificationResult.extractedIdNumber) {
      // Remove any spaces or dashes from ID numbers for comparison
      const normalizeIdNumber = (id) => id.toString().replace(/[\s-]/g, '');

      verificationResult.idNumberMatch =
        normalizeIdNumber(verificationResult.extractedIdNumber) ===
        normalizeIdNumber(userData.idNumber);
    }

    return {
      success: true,
      verification: verificationResult,
      timestamp: new Date(),
    };
  } catch (error) {
    console.error('OpenAI Identity Verification Error:', error);
    throw new ApiError(
      `Identity verification failed: ${error.message}`,
      error.statusCode || 500,
    );
  }
};

/**
 * Verify identity and update user status
 * @param {string} userId - User ID
 * @param {string[]} imagePaths - Array of image file paths
 * @param {Object} userData - User data to verify against
 * @returns {Object} Verification result with user update status
 */
const verifyAndUpdateUserIdentity = async (userId, imagePaths, userData) => {
  try {
    const verificationResult = await verifyIdentityWithOpenAI(
      imagePaths,
      userData,
    );

    // Determine verification status based on AI analysis
    let verificationStatus = 'pending';
    let note = '';

    if (verificationResult.verification.verificationStatus === 'verified') {
      verificationStatus = 'verified';
      note = 'Identity verified automatically using AI';
    } else if (
      verificationResult.verification.verificationStatus === 'rejected'
    ) {
      verificationStatus = 'rejected';
      note = `Rejected: ${verificationResult.verification.issues.join(', ')}`;
    } else {
      verificationStatus = 'pending';
      note = 'Needs manual review';
    }

    return {
      verificationResult,
      verificationStatus,
      note,
      recommendedAction: verificationResult.verification.verificationStatus,
    };
  } catch (error) {
    throw new ApiError(
      `Identity verification and update failed: ${error.message}`,
      error.statusCode || 500,
    );
  }
};

module.exports = {
  verifyIdentityWithOpenAI,
  verifyAndUpdateUserIdentity,
  imageToBase64,
};
