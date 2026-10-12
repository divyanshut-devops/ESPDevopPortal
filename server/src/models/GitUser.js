import mongoose from 'mongoose'

const gitUserSchema = new mongoose.Schema(
  {
    companyUser: { type: String, required: true, trim: true },
    username: { type: String, required: true, trim: true, unique: true },
    remark: { type: String, default: '' },
  },
  { timestamps: true },
)

export const GitUser = mongoose.models.GitUser || mongoose.model('GitUser', gitUserSchema)
