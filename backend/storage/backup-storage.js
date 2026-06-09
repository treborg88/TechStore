const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const { promisify } = require('util');

let S3Client;
let ListObjectsV2Command;
let GetObjectCommand;
let PutObjectCommand;
let DeleteObjectCommand;

const ensureS3Sdk = () => {
  if (S3Client) return;
  const s3 = require('@aws-sdk/client-s3');
  S3Client = s3.S3Client;
  ListObjectsV2Command = s3.ListObjectsV2Command;
  GetObjectCommand = s3.GetObjectCommand;
  PutObjectCommand = s3.PutObjectCommand;
  DeleteObjectCommand = s3.DeleteObjectCommand;
};

const streamPipeline = promisify(pipeline);
const VALID_EXTENSIONS = ['.tar.gz', '.tar', '.sql'];

class LocalBackupStorage {
  constructor(baseDir) {
    this.baseDir = path.resolve(baseDir);
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return null;
    const base = path.basename(filename);
    if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
    if (!VALID_EXTENSIONS.some((ext) => base.endsWith(ext))) return null;
    return base;
  }

  async _ensureBaseDir() {
    await fs.promises.mkdir(this.baseDir, { recursive: true });
  }

  async listArchives() {
    await this._ensureBaseDir();
    const entries = await fs.promises.readdir(this.baseDir);
    const archives = [];
    for (const name of entries) {
      const sanitized = this._sanitizeFilename(name);
      if (!sanitized) continue;
      const filePath = path.join(this.baseDir, sanitized);
      const stats = await fs.promises.stat(filePath);
      archives.push({ filename: sanitized, size: stats.size, date: stats.mtime, isArchive: sanitized.endsWith('.tar.gz') });
    }
    return archives.sort((a, b) => b.date - a.date);
  }

  async saveArchive(srcPath, filename) {
    await this._ensureBaseDir();
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid backup filename');
    const destPath = path.join(this.baseDir, sanitized);
    if (path.resolve(srcPath) === path.resolve(destPath)) {
      return { filename: sanitized, path: destPath };
    }
    try {
      await fs.promises.rename(srcPath, destPath);
    } catch (err) {
      if (err.code === 'EXDEV') {
        await fs.promises.copyFile(srcPath, destPath);
        await fs.promises.unlink(srcPath);
      } else {
        throw err;
      }
    }
    return { filename: sanitized, path: destPath };
  }

  async getArchivePath(filename) {
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid archive filename');
    const filePath = path.join(this.baseDir, sanitized);
    const stats = await fs.promises.stat(filePath).catch(() => null);
    if (!stats || !stats.isFile()) throw new Error('Archive not found');
    return filePath;
  }

  async cleanupDownloadedArchive(_filePath) {
    // No-op for local storage
  }

  async deleteArchive(filename) {
    const filePath = await this.getArchivePath(filename);
    await fs.promises.unlink(filePath);
    return true;
  }

  async uploadArchive(tmpPath, filename) {
    return this.saveArchive(tmpPath, filename);
  }
}

class S3BackupStorage {
  constructor({ bucketName, region, accessKeyId, secretAccessKey, endpoint, forcePathStyle, tempDir }) {
    ensureS3Sdk();
    if (!bucketName || !region || !accessKeyId || !secretAccessKey) {
      throw new Error('Missing S3 backup storage configuration');
    }
    this.bucketName = bucketName;
    this.tempDir = tempDir || path.join(__dirname, '..', 'backups', '.tmp');
    fs.mkdirSync(this.tempDir, { recursive: true });
    this.client = new S3Client({
      region,
      endpoint: endpoint || undefined,
      forcePathStyle: forcePathStyle || false,
      credentials: { accessKeyId, secretAccessKey }
    });
  }

  _sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return null;
    const base = path.basename(filename);
    if (base.includes('..') || base.includes('/') || base.includes('\\')) return null;
    if (!VALID_EXTENSIONS.some((ext) => base.endsWith(ext))) return null;
    return base;
  }

  async listArchives() {
    const archives = [];
    let continuationToken;
    do {
      const result = await this.client.send(new ListObjectsV2Command({
        Bucket: this.bucketName,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      }));
      for (const item of result.Contents || []) {
        const filename = item.Key;
        const sanitized = this._sanitizeFilename(filename);
        if (!sanitized) continue;
        archives.push({ filename: sanitized, size: item.Size, date: item.LastModified, isArchive: sanitized.endsWith('.tar.gz') });
      }
      continuationToken = result.NextContinuationToken;
    } while (continuationToken);
    return archives.sort((a, b) => b.date - a.date);
  }

  async saveArchive(srcPath, filename) {
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid backup filename');
    const body = fs.createReadStream(srcPath);
    await this.client.send(new PutObjectCommand({ Bucket: this.bucketName, Key: sanitized, Body: body }));
    return { filename: sanitized, path: srcPath };
  }

  async _downloadToTemp(filename) {
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid archive filename');

    const tempPath = path.join(this.tempDir, `${Date.now()}-${sanitized}`);
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucketName, Key: sanitized }));
    const body = result.Body;
    if (!body || typeof body.pipe !== 'function') {
      throw new Error('Invalid S3 object body');
    }
    await streamPipeline(body, fs.createWriteStream(tempPath));
    return tempPath;
  }

  async getArchivePath(filename) {
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid archive filename');
    return this._downloadToTemp(sanitized);
  }

  async cleanupDownloadedArchive(filePath) {
    try {
      await fs.promises.unlink(filePath);
    } catch (_err) {
      // ignore
    }
  }

  async deleteArchive(filename) {
    const sanitized = this._sanitizeFilename(filename);
    if (!sanitized) throw new Error('Invalid archive filename');
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucketName, Key: sanitized }));
    return true;
  }

  async uploadArchive(tmpPath, filename) {
    return this.saveArchive(tmpPath, filename);
  }
}

const createBackupStorageAdapter = (config) => {
  const storageMode = (config.BACKUP_STORAGE || 'local').toLowerCase();
  if (storageMode === 's3' || storageMode === 'aws') {
    return new S3BackupStorage({
      bucketName: config.S3_BUCKET_NAME,
      region: config.S3_REGION,
      accessKeyId: config.S3_ACCESS_KEY_ID,
      secretAccessKey: config.S3_SECRET_ACCESS_KEY,
      endpoint: config.S3_ENDPOINT,
      forcePathStyle: config.S3_FORCE_PATH_STYLE,
      tempDir: path.join(__dirname, '..', 'backups', '.tmp')
    });
  }
  return new LocalBackupStorage(config.BACKUP_STORAGE_PATH || path.join(__dirname, '..', 'backups'));
};

module.exports = { LocalBackupStorage, S3BackupStorage, createBackupStorageAdapter };
