import { Injectable } from '@nestjs/common';
import { createReadStream, existsSync, readFileSync } from 'fs';
import { extname, join } from 'path';
import OpenAI from 'openai';
import { ApiException } from '../common/exceptions/api.exception';

@Injectable()
export class OpenAiProviderService {
  private client: any;

  get apiKey() {
    return process.env.OPENAI_API_KEY;
  }

  get vectorStoreId() {
    return process.env.OPENAI_VECTOR_STORE_ID;
  }

  get chatModel() {
    return process.env.AI_CHAT_MODEL || 'gpt-5.1';
  }

  get syncLimit() {
    return Number(process.env.AI_KNOWLEDGE_SYNC_LIMIT) || 25;
  }

  requireApiKey() {
    if (!this.apiKey || this.apiKey === 'your-openai-api-key-here') {
      throw new ApiException('OpenAI API key is not configured', 500);
    }
    return this.apiKey;
  }

  requireVectorStoreId() {
    this.requireApiKey();
    if (!this.vectorStoreId) throw new ApiException('OPENAI_VECTOR_STORE_ID is not configured', 500);
    return this.vectorStoreId;
  }

  openai() {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.requireApiKey() });
    }
    return this.client;
  }

  async createCatalogChatResponse(payload: any) {
    return this.openai().responses.create(payload);
  }

  async deleteVectorStoreFile(fileId?: string, vectorStoreId?: string) {
    if (!fileId || !vectorStoreId) return;
    try {
      await this.openai().vectorStores.files.delete(fileId, { vector_store_id: vectorStoreId });
    } catch (error: any) {
      if (error?.status !== 404) throw error;
    }
  }

  async uploadVectorTextFile(vectorStoreId: string, tempPath: string) {
    return this.openai().vectorStores.files.uploadAndPoll(vectorStoreId, createReadStream(tempPath), { pollIntervalMs: 1000 });
  }

  async verifyIdentityWithVision(imagePaths: string[], userData: Record<string, any> = {}) {
    this.requireApiKey();
    if (!imagePaths?.length) throw new ApiException('No images provided for verification', 400);
    const images = imagePaths.map((imagePath) => this.imageToContentPart(imagePath));
    const systemPrompt = `You are an expert identity verification system. Respond with ONLY valid JSON containing documentType, extractedName, extractedIdNumber, dateOfBirth, expiryDate, nationality, isAuthentic, confidence, issues, and verificationStatus. verificationStatus must be verified, rejected, or needs_review.`;
    const userPrompt = `Analyze these ID document images and compare them with the user data when present.${userData.name ? ` User claims name: ${userData.name}` : ''}${userData.idNumber ? ` User claims ID number: ${userData.idNumber}` : ''}`;
    try {
      return await this.openai().chat.completions.create({
        model: process.env.AI_ID_VERIFICATION_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [{ type: 'text', text: userPrompt }, ...images] },
        ],
        max_tokens: 1000,
        temperature: 0.1,
        response_format: { type: 'json_object' },
      });
    } catch (error: any) {
      if (!String(error?.message || '').includes('response_format')) throw error;
      return this.openai().chat.completions.create({
        model: process.env.AI_ID_VERIFICATION_MODEL || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: [{ type: 'text', text: userPrompt }, ...images] },
        ],
        max_tokens: 1000,
        temperature: 0.1,
      });
    }
  }

  private imageToContentPart(imagePath: string) {
    const fullPath = this.resolveIdDocumentPath(imagePath);
    if (!existsSync(fullPath)) throw new ApiException(`Image file not found: ${imagePath}`, 404);
    const ext = extname(fullPath).toLowerCase();
    let mimeType = 'image/jpeg';
    if (ext === '.png') mimeType = 'image/png';
    if (ext === '.webp') mimeType = 'image/webp';
    if (ext === '.gif') mimeType = 'image/gif';
    return {
      type: 'image_url',
      image_url: {
        url: `data:${mimeType};base64,${readFileSync(fullPath).toString('base64')}`,
      },
    };
  }

  private resolveIdDocumentPath(imagePath: string) {
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return join(process.cwd(), 'uploads', 'users', 'idDocuments', imagePath.split('/').pop() || '');
    }
    if (imagePath.startsWith('/')) return imagePath;
    return join(process.cwd(), 'uploads', 'users', 'idDocuments', imagePath);
  }
}
