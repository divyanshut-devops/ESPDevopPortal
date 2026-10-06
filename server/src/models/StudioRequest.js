import mongoose from 'mongoose'

const pairSchema = new mongoose.Schema(
  {
    key: { type: String, default: '' },
    value: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
  },
  { _id: false },
)

const studioRequestSchema = new mongoose.Schema(
  {
    ownerEmail: { type: String, required: true, index: true, lowercase: true },
    name: { type: String, default: 'My request' },
    method: { type: String, default: 'GET' },
    url: { type: String, default: '/api/auth/me' },
    headers: { type: [pairSchema], default: [] },
    queryParams: { type: [pairSchema], default: [] },
    body: { type: String, default: '' },
    useSession: { type: Boolean, default: true },
  },
  { timestamps: true },
)

export const StudioRequest = mongoose.models.StudioRequest || mongoose.model('StudioRequest', studioRequestSchema)
