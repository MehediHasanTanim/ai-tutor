import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash, randomUUID } from 'node:crypto';
import { ErrorCode } from '@ai-tutor/shared-types';
import configuration from '../../config/configuration';
import { AppException } from '../../common/exceptions/app.exception';

/**
 * Object storage — architecture §13, doc 07 Weeks 3–4.
 *
 * S3-compatible, so the same code runs against SeaweedFS locally and real S3
 * in deployed environments (see the README's deviation note on MinIO).
 */
@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly configured: boolean;

  constructor(
    @Inject(configuration.KEY)
    private readonly config: ConfigType<typeof configuration>,
  ) {
    const { endpoint, bucket, accessKey, secretKey, region } = config.storage;
    this.bucket = bucket ?? '';
    this.configured = Boolean(endpoint && bucket && accessKey && secretKey);

    this.client = new S3Client({
      endpoint,
      region,
      credentials:
        accessKey && secretKey ? { accessKeyId: accessKey, secretAccessKey: secretKey } : undefined,
      // Required for SeaweedFS and MinIO, which serve buckets as a path
      // segment rather than a subdomain.
      forcePathStyle: true,
    });
  }

  /**
   * Ensures the bucket exists.
   *
   * Done at boot rather than on first upload so a misconfigured bucket is a
   * startup log line, not a 500 the first time an admin uploads a textbook.
   */
  async onModuleInit(): Promise<void> {
    if (!this.configured) {
      this.logger.warn('Object storage is not configured; uploads will fail.');
      return;
    }

    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      try {
        await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
        this.logger.log(`Created bucket "${this.bucket}"`);
      } catch (error) {
        this.logger.warn(`Could not verify or create bucket "${this.bucket}": ${String(error)}`);
      }
    }
  }

  /**
   * Stores a file and returns its key plus a content hash.
   *
   * The hash is what makes ingestion idempotent: doc 07 requires that
   * re-processing a document twice produce no duplicate chunks, and matching
   * on filename would not survive an admin renaming a PDF.
   */
  async upload(params: {
    buffer: Buffer;
    mimeType: string;
    originalName: string;
    prefix: string;
  }): Promise<{ key: string; checksum: string; sizeBytes: number }> {
    if (!this.configured) {
      throw new AppException(ErrorCode.SERVICE_UNAVAILABLE, {
        message: 'Object storage is not configured (S3_ENDPOINT / S3_BUCKET)',
      });
    }

    const checksum = createHash('sha256').update(params.buffer).digest('hex');
    const extension = extensionOf(params.originalName);
    const key = `${params.prefix}/${new Date().getFullYear()}/${randomUUID()}${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: params.buffer,
        ContentType: params.mimeType,
        // Kept so an operator can trace a stored object back to what was
        // uploaded without a database round trip.
        Metadata: { 'original-name': encodeURIComponent(params.originalName), checksum },
      }),
    );

    return { key, checksum, sizeBytes: params.buffer.byteLength };
  }

  async download(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );

    const body = response.Body;
    if (!body) {
      throw new AppException(ErrorCode.NOT_FOUND, { message: `Object "${key}" has no body` });
    }

    return Buffer.from(await body.transformToByteArray());
  }

  /**
   * A time-limited URL — architecture §13 requires signed URLs.
   *
   * Short by default. These point at student-uploaded images as well as
   * textbooks, and a long-lived URL is a link that outlives the session that
   * was allowed to see it.
   */
  async signedUrl(key: string, expiresInSeconds = 300): Promise<string> {
    return getSignedUrl(this.client, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  get isConfigured(): boolean {
    return this.configured;
  }
}

function extensionOf(filename: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/u.exec(filename);
  return match ? `.${match[1]!.toLowerCase()}` : '';
}
