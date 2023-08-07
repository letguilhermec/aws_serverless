const queryString = new URLSearchParams(window.location.search)
const resultId = queryString.get('id')

const bail = () => {
  alert('Nenhum resultado encontrado')
  // window.location = '/'
}

if (!resultId) bail()

fetch(`https://vm3z8tyqhi.execute-api.us-east-1.amazonaws.com/api/results/${resultId}`)
  .then((r) => {
    if (!r.ok) bail()
    return r.json()
  })
  .then(({ result }) => {
    document.getElementById('student-name').innerText = result.name
    document.getElementById('correct').innerText = result.totalCorrectAnswers
  })
  .catch((e) => {
    console.error(e)
    bail()
  })
