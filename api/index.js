const { buildResponse } = require('./utils')
const { getUserByCredentials, saveResultToDatabase, getResultById } = require('./database')
const { createToken, authorize } = require('./auth')

function extractBody(event) {
  if (!event?.body) {
    return buildResponse(422, { error: 'Missing body' })
  }
  return JSON.parse(event.body)
}

module.exports.login = async (event) => {
  const { name, password } = extractBody(event)
  const hashedPass = pbkdf2Sync(password, process.env.SALT, 100000, 64, 'sha512').toString('hex')

  const user = await getUserByCredentials(name, hashedPass)

  if (!user) {
    return buildResponse(401, { error: 'Invalid credentials.' })
  }

  const token = createToken(name, user._id)

  return buildResponse(200, { token })
}

module.exports.sendResponse = async (event) => {
  const authResult = await authorize(event)
  if (authResult.statusCode === 401) return authResult

  const { name, answers } = extractBody(event)
  const correctQuestions = [3, 1, 0, 2]

  const totalCorrectAnswers = answers.reduce((acc, answer, index) => {
    if (answer === correctQuestions[index]) {
      acc++
    }
    return acc
  }, 0)

  const result = {
    name,
    answers,
    totalCorrectAnswers,
    totalAnswers: answers.length
  }

  const insertedId = await saveResultToDatabase(result)

  return buildResponse(201, {
    resultId: insertedId,
    __hypermedia: {
      href: `/results.html`,
      query: { id: insertedId }
    }
  })
}

module.exports.getResult = async (event) => {
  const authResult = await authorize(event)
  if (authResult.statusCode === 401) return authResult

  const result = await getResultById(event.pathParameters.id)

  if (!result) {
    return buildResponse(404, { error: 'Result not found' })
  }

  return buildResponse(200, result)
}
