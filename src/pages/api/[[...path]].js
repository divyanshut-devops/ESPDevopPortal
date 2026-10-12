process.env.NEXT_EMBED = '1'

let apiPromise

function loadApi() {
  if (!apiPromise) {
    apiPromise = import('../../../server/src/index.js').then(async (mod) => {
      await mod.bootServices()
      return mod.app
    })
  }
  return apiPromise
}

export default async function handler(req, res) {
  const app = await loadApi()
  return app(req, res)
}

export const config = {
  api: {
    bodyParser: false,
    externalResolver: true,
  },
  maxDuration: 60,
}
