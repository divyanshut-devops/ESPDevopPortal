import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'

function env(name) {
  return String(process.env[name] || '')
    .trim()
    .replace(/^['"]|['"]$/g, '')
}

export function isS3Configured() {
  return Boolean(env('AWS_ACCESS_KEY_ID') && env('AWS_SECRET_ACCESS_KEY') && env('S3_BUCKET'))
}

function client() {
  if (!isS3Configured()) {
    const error = new Error('S3 is not configured. Add AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET in .env')
    error.status = 503
    throw error
  }
  const endpoint = env('AWS_ENDPOINT_URL_S3') || env('AWS_ENDPOINT_URL')
  const region = env('AWS_REGION') || (endpoint.includes('us-east-2') ? 'us-east-2' : 'us-east-1')
  return new S3Client({
    region,
    credentials: {
      accessKeyId: env('AWS_ACCESS_KEY_ID'),
      secretAccessKey: env('AWS_SECRET_ACCESS_KEY'),
    },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
    ...(endpoint
      ? {
          endpoint,
          forcePathStyle: env('S3_FORCE_PATH_STYLE') !== 'false',
        }
      : {}),
  })
}

function bucket() {
  return env('S3_BUCKET')
}

export function userPrefix(email) {
  const root = env('S3_PREFIX') || 'esp-devops-drive'
  const safe = String(email || 'user').toLowerCase().replace(/[^a-z0-9.@_-]/g, '_')
  return `${root}/${safe}/`
}

export function sanitizeKey(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '.' && part !== '..')
    .join('/')
}

export async function listDriveFiles(email) {
  const s3 = client()
  const prefix = userPrefix(email)
  const listed = await s3.send(
    new ListObjectsV2Command({
      Bucket: bucket(),
      Prefix: prefix,
      MaxKeys: 200,
    }),
  )
  return (listed.Contents || [])
    .filter((item) => item.Key && item.Key !== prefix && !item.Key.endsWith('/'))
    .map((item) => ({
      key: item.Key.slice(prefix.length),
      name: item.Key.slice(prefix.length).split('/').pop(),
      size: item.Size || 0,
      updatedAt: item.LastModified,
    }))
}

export async function putDriveFile(email, filename, body, contentType) {
  const s3 = client()
  const key = sanitizeKey(filename)
  if (!key) {
    const error = new Error('File name is required.')
    error.status = 400
    throw error
  }
  const fullKey = `${userPrefix(email)}${key}`
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket(),
      Key: fullKey,
      Body: body,
      ContentType: contentType || 'application/octet-stream',
    }),
  )
  return { key, name: key.split('/').pop() }
}

export async function getDriveFile(email, filename) {
  const s3 = client()
  const key = sanitizeKey(filename)
  const object = await s3.send(
    new GetObjectCommand({
      Bucket: bucket(),
      Key: `${userPrefix(email)}${key}`,
    }),
  )
  return {
    key,
    name: key.split('/').pop(),
    contentType: object.ContentType || 'application/octet-stream',
    body: object.Body,
  }
}

export async function deleteDriveFile(email, filename) {
  const s3 = client()
  const key = sanitizeKey(filename)
  await s3.send(
    new DeleteObjectCommand({
      Bucket: bucket(),
      Key: `${userPrefix(email)}${key}`,
    }),
  )
  return { ok: true }
}
