const { MongoClient, ObjectId } = require("mongodb")

let connectionInstance = null

async function connectToDatabase() {
  if (connectionInstance) return connectionInstance

  const client = new MongoClient(process.env.MONGODB_CONNECTIONSTRING)
  const connection = await client.connect()
  connectionInstance = connection.db(process.env.MONGODB_DBNAME)
  return connectionInstance
}

async function getUserByCredentials(name, password) {
  const client = await connectToDatabase()
  const collection = await client.collection('users')
  const user = await collection.findOne({
    name,
    password
  })

  if (!user) return null

  return user
}

async function saveResultToDatabase(result) {
  const client = await connectToDatabase()
  const collection = await client.collection('results')
  const { insertedId } = await collection.insertOne(result)
  return insertedId
}

async function getResultById(id) {
  const client = await connectToDatabase()
  const collection = await client.collection('results')

  const result = await collection.findOne({
    _id: new ObjectId(id)
  })

  if (!result) return null

  return result
}

module.exports = {
  getUserByCredentials,
  saveResultToDatabase,
  getResultById
}
