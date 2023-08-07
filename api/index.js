const { MongoClient, ObjectId } = require("mongodb")
const { pbkdf2Sync } = require('crypto')
const { sign, verify } = require('jsonwebtoken')
const { buildResponse } = require('./utils')

let connectionInstance = null

async function connectToDatabase() {
  if (connectionInstance) return connectionInstance

  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING)
  const connection = await client.connect()
  connectionInstance = connection.db(process.env.MONGODB_DBNAME)
  return connectionInstance
}

async function authorize(event) {
  const { authorization } = event.headers

  if (!authorization) {
    return buildResponse(401, { error: 'Missing authorization header.' })
  }

  const [type, token] = authorization.split(' ')
  if (type !== 'Bearer' || !token) {
    return buildResponse(401, { error: 'Unsupported authorization type.' })
  }

  const decodedToken = verify(token, process.env.JWT_SECRET, {
    audience: 'alura-serverless'
  })

  if (!decodedToken) {
    return buildResponse(401, { error: 'Invalid token.' })
  }

  return decodedToken
}

function extractBody(event) {
  if (!event?.body) {
    return buildResponse(422, { error: 'Missing body' })
  }
  return JSON.parse(event.body)
}

module.exports.login = async (event) => {
  const { name, password } = extractBody(event)
  const hashedPass = pbkdf2Sync(password, process.env.SALT, 100000, 64, 'sha512').toString('hex')

  const client = await connectToDatabase()
  const collection = await client.collection('users')
  const user = await collection.findOne({
    name: name,
    password: hashedPass
  })

  if (!user) {
    return buildResponse(401, { error: 'Invalid credentials.' })
  }

  const token = sign({ name, id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    audience: 'alura-serverless'
  })

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

  const client = await connectToDatabase()
  const collection = await client.collection('results')
  const { insertedId } = await collection.insertOne(result)

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

  const client = await connectToDatabase()
  const collection = await client.collection('results')

  const result = await collection.findOne({
    _id: new ObjectId(event.pathParameters.id)
  })

  if (!result) {
    return buildResponse(404, { error: 'Result not found' })
  }

  return buildResponse(200, result)
}
