const { MongoClient, ObjectId } = require("mongodb")
const { pbkdf2Sync } = require('crypto')
const { sign, verify } = require('jsonwebtoken')

let connectionInstance = null

async function connectToDatabase() {
  if (connectionInstance) return connectionInstance

  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING)
  const connection = await client.connect()
  connectionInstance = connection.db(process.env.MONGODB_DBNAME)
  return connectionInstance
}

async function authorize(event) {
  const { authorization } = event.header

  if (!authorization) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing authorization header.' })
    }
  }

  const [type, token] = authorization.split(' ')
  if (type !== 'Bearer' || !token) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Unsupported authorization type.' })
    }
  }

  const decodedToken = verify(token, process.env.JWT_SECRET, {
    audience: 'alura-serverless'
  })

  if (!decodedToken) {
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid token.' })
    }
  }

  return decodedToken
}

function extractBody(event) {
  if (!event?.body) {
    return {
      statusCode: 422,
      body: JSON.stringify({ error: 'Missing body' })
    }
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
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid credentials.' })
    }
  }

  const token = sign({ name, id: user._id }, process.env.JWT_SECRET, {
    expiresIn: '24h',
    audience: 'alura-serverless'
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token })
  }
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

  return {
    statusCode: 201,
    body: JSON.stringify(
      {
        resultId: insertedId,
        __hypermedia: {
          href: `/results.html`,
          query: { id: insertedId }
        }
      }),
    headers: {
      'Content-Type': 'application/json'
    }
  }
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
    return {
      statusCode: 404,
      body: JSON.stringify({ error: 'Result not found' }),
      headers: {
        'Content-Type': 'application/json'
      }
    }
  }
  return {
    statusCode: 200,
    body: JSON.stringify(result),
    headers: {
      'Content-Type': 'application/json'
    }
  }
}
